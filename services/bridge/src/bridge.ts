import { bridgeSubscriptions } from "@mzigo/contracts";
import mqtt, { type MqttClient } from "mqtt";
import type { Db } from "./db";
import { Ingest } from "./ingest";
import { dailyMaintenance, refreshPublicSnapshots } from "./maintenance";
import { OutboxRelay, type Publisher } from "./outbox";

export interface BridgeConfig {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  /** null for brokers without shared subscriptions (e.g. a test broker). */
  shareGroup: string | null;
  /** MQTT 5 in production (EMQX); 4 (3.1.1) for brokers that don't speak 5. */
  protocolVersion?: 4 | 5;
  flushIntervalMs: number;
  snapshotIntervalSeconds: number;
  outboxPollMs: number;
}

export interface Bridge {
  ingest: Ingest;
  outbox: OutboxRelay;
  client: MqttClient;
  stop(): Promise<void>;
}

export async function startBridge(db: Db, config: BridgeConfig): Promise<Bridge> {
  const client = await mqtt.connectAsync(config.mqttUrl, {
    clientId: `bridge-${crypto.randomUUID().slice(0, 8)}`,
    username: config.mqttUsername,
    password: config.mqttPassword,
    protocolVersion: config.protocolVersion ?? 5,
    clean: true,
    reconnectPeriod: 2000,
  });
  client.on("error", (err) => console.error("[mqtt] error", err.message));
  client.on("reconnect", () => console.warn("[mqtt] reconnecting"));

  const ingest = new Ingest(db);
  client.on("message", (topic, payload) => void ingest.handle(topic, payload));
  // Subscribe on every (re)connect: with a clean session the broker forgets subscriptions.
  const subscribe = () =>
    client.subscribeAsync(bridgeSubscriptions(config.shareGroup), { qos: 1 }).catch((err) => console.error("[mqtt] subscribe failed", err));
  client.on("connect", subscribe);
  await subscribe();

  const publisher: Publisher = {
    async publish(topic, payload, opts) {
      await client.publishAsync(topic, payload, opts);
    },
  };
  const outbox = new OutboxRelay(db, publisher);
  const stopOutbox = await outbox.start(config.outboxPollMs);

  const timers = [
    setInterval(() => ingest.flush().catch((err) => console.error("[ingest] flush failed", err)), config.flushIntervalMs),
    setInterval(
      () => refreshPublicSnapshots(db, config.snapshotIntervalSeconds).catch((err) => console.error("[snapshots] failed", err)),
      Math.min(60_000, config.snapshotIntervalSeconds * 1000),
    ),
    setInterval(() => {
      ingest.prune();
      dailyMaintenance(db).catch((err) => console.error("[maintenance] failed", err));
    }, 24 * 3600_000),
  ];
  await dailyMaintenance(db);

  return {
    ingest,
    outbox,
    client,
    async stop() {
      for (const t of timers) clearInterval(t);
      await stopOutbox();
      await ingest.flush().catch((err) => console.error("[ingest] final flush failed", err));
      await client.endAsync();
    },
  };
}
