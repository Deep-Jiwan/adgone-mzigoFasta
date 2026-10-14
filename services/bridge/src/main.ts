import { startBridge } from "./bridge";
import { createDb } from "./db";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
}

const db = createDb(env("DATABASE_URL"), 10);
const bridge = await startBridge(db, {
  mqttUrl: env("MQTT_URL", "mqtt://localhost:1883"),
  mqttUsername: process.env.MQTT_USERNAME,
  mqttPassword: process.env.MQTT_PASSWORD,
  shareGroup: process.env.MQTT_SHARE_GROUP === "" ? null : env("MQTT_SHARE_GROUP", "bridge"),
  flushIntervalMs: Number(env("FLUSH_INTERVAL_MS", "1000")),
  snapshotIntervalSeconds: Number(env("PUBLIC_SNAPSHOT_INTERVAL_SECONDS", "300")),
  outboxPollMs: Number(env("OUTBOX_POLL_MS", "2000")),
});
console.log("[bridge] running");

setInterval(() => {
  const { accepted, dropped } = bridge.ingest.stats;
  console.log(`[bridge] messages accepted=${accepted} dropped=${dropped}`);
}, 60_000).unref();

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`[bridge] ${signal}: stopping`);
    await bridge.stop();
    await db.end();
    process.exit(0);
  });
}
