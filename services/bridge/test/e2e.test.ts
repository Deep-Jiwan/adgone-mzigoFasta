import { createServer, type Server } from "node:net";
import { Aedes } from "aedes";
import { topics } from "@mzigo/contracts";
import mqtt from "mqtt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startBridge, type Bridge } from "../src/bridge";
import { db, makeDelivery, nowS, waitFor } from "./fixtures";

// A real MQTT broker in-process: driver phone → broker → bridge → Postgres, and outbox → broker → shop.
let broker: Aedes;
let server: Server;
let url: string;
let bridge: Bridge;

beforeEach(async () => {
  broker = await Aedes.createBroker();
  server = createServer(broker.handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  url = `mqtt://127.0.0.1:${port}`;
  // The test broker speaks MQTT 3.1.1 without shared subscriptions, so the bridge subscribes plainly.
  bridge = await startBridge(db, {
    mqttUrl: url, shareGroup: null, protocolVersion: 4, flushIntervalMs: 100, snapshotIntervalSeconds: 300, outboxPollMs: 200,
  });
});

afterEach(async () => {
  await bridge.stop();
  await new Promise<void>((resolve) => broker.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("bridge end to end", () => {
  it("stores what a driver publishes, while the shop receives it live", async () => {
    const d = await makeDelivery();
    const topic = topics.deliveryLocation(d.shopId, d.deliveryId);

    const shop = await mqtt.connectAsync(url);
    const received: string[] = [];
    shop.on("message", (_t, payload) => received.push(payload.toString()));
    await shop.subscribeAsync(topics.shopAll(d.shopId));

    const phone = await mqtt.connectAsync(url);
    await phone.publishAsync(topic, JSON.stringify({ t: nowS(), lat: -6.8, lng: 39.27, acc: 9, seq: 1 }), { qos: 0, retain: true });

    await waitFor(async () => (await db`select 1 from location_points where delivery_id = ${d.deliveryId}`).length > 0);
    await waitFor(async () => received.length > 0);
    expect(JSON.parse(received[0]!)).toMatchObject({ lat: -6.8, seq: 1 });

    await phone.endAsync();
    await shop.endAsync();
  });

  it("announces outbox rows to subscribers as soon as they are committed", async () => {
    const d = await makeDelivery();
    const evtTopic = topics.deliveryEvents(d.shopId, d.deliveryId);
    const shop = await mqtt.connectAsync(url);
    const received: unknown[] = [];
    shop.on("message", (_t, payload) => received.push(JSON.parse(payload.toString())));
    await shop.subscribeAsync(evtTopic, { qos: 1 });

    const message = { type: "delivery.status", eventId: "1", deliveryId: d.deliveryId, action: "deliver", status: "DELIVERED", at: new Date().toISOString() };
    await db`insert into outbox (topic, payload) values (${evtTopic}, ${db.json(message)})`;

    await waitFor(async () => received.length > 0);
    expect(received[0]).toEqual(message);
    await shop.endAsync();
  });
});
