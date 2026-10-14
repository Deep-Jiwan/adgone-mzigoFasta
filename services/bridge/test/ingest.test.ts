import { topics } from "@mzigo/contracts";
import { describe, expect, it } from "vitest";
import { Ingest } from "../src/ingest";
import { refreshPublicSnapshots } from "../src/maintenance";
import { OutboxRelay } from "../src/outbox";
import { db, makeDelivery, nowS } from "./fixtures";

const msg = (o: unknown) => Buffer.from(JSON.stringify(o));

describe("ingest", () => {
  it("stores points, keeps the latest position, and de-duplicates retries", async () => {
    const d = await makeDelivery();
    const ingest = new Ingest(db);
    const topic = topics.deliveryLocation(d.shopId, d.deliveryId);
    const t = nowS();
    await ingest.handle(topic, msg({ t: t - 20, lat: -6.81, lng: 39.27, acc: 10, seq: 1 }));
    await ingest.handle(topic, msg({ t: t - 10, lat: -6.809, lng: 39.27, acc: 10, seq: 2 }));
    await ingest.handle(topic, msg({ t: t - 10, lat: -6.809, lng: 39.27, acc: 10, seq: 2 })); // duplicate delivery
    expect(await ingest.flush()).toBe(3);

    const points = await db`select seq from location_points where delivery_id = ${d.deliveryId} order by seq`;
    expect(points.map((p) => p.seq)).toEqual([1, 2]);
    const [latest] = await db`select ST_Y(pin::geometry) as lat, extract(epoch from t)::int as t from delivery_latest where delivery_id = ${d.deliveryId}`;
    expect(latest).toEqual({ lat: -6.809, t: t - 10 });
  });

  it("backfills an offline batch without moving 'latest' backwards", async () => {
    const d = await makeDelivery();
    const ingest = new Ingest(db);
    const t = nowS();
    await ingest.handle(topics.deliveryLocation(d.shopId, d.deliveryId), msg({ t, lat: -6.80, lng: 39.27, acc: 10, seq: 10 }));
    await ingest.flush();
    await ingest.handle(
      topics.deliveryLocationBatch(d.shopId, d.deliveryId),
      msg({ points: [3, 2, 1].map((i) => ({ t: t - i * 60, lat: -6.81 + i / 1000, lng: 39.27, acc: 10, seq: 10 - i })) }),
    );
    await ingest.flush();
    expect(await db`select count(*)::int as n from location_points`).toEqual([{ n: 4 }]);
    const [latest] = await db`select extract(epoch from t)::int as t from delivery_latest`;
    expect(latest!.t).toBe(t);
  });

  it("drops points for the wrong shop, unknown or finished deliveries, and junk", async () => {
    const d = await makeDelivery();
    const done = await makeDelivery({ status: "DELIVERED" });
    const ingest = new Ingest(db);
    const fix = msg({ t: nowS(), lat: -6.8, lng: 39.27, acc: 10, seq: 1 });
    await ingest.handle(topics.deliveryLocation(done.shopId, d.deliveryId), fix);
    await ingest.handle(topics.deliveryLocation(d.shopId, crypto.randomUUID()), fix);
    await ingest.handle(topics.deliveryLocation(done.shopId, done.deliveryId), fix);
    await ingest.handle(topics.deliveryLocation(d.shopId, d.deliveryId), Buffer.from("not json"));
    await ingest.handle(topics.deliveryLocation(d.shopId, d.deliveryId), msg({ t: nowS() + 3600, lat: -6.8, lng: 39.27, acc: 10, seq: 1 }));
    await ingest.flush();
    expect(ingest.stats).toEqual({ accepted: 0, dropped: 5 });
    expect(await db`select * from location_points`).toHaveLength(0);
  });

  it("raises fraud signals, throttled per delivery", async () => {
    const d = await makeDelivery();
    const ingest = new Ingest(db);
    const topic = topics.deliveryLocation(d.shopId, d.deliveryId);
    const t = nowS();
    await ingest.handle(topic, msg({ t: t - 30, lat: -6.8189, lng: 39.2738, acc: 10, seq: 1 }));
    await ingest.handle(topic, msg({ t: t - 10, lat: -6.7629, lng: 39.2468, acc: 10, seq: 2, mock: true }));
    await ingest.handle(topic, msg({ t: t - 5, lat: -6.7629, lng: 39.2468, acc: 10, seq: 3, mock: true }));
    await ingest.flush();
    const signals = await db`select kind, driver_id from fraud_signals order by kind`;
    expect(signals).toEqual([
      { kind: "impossible_speed", driver_id: d.driverId },
      { kind: "mock_location", driver_id: d.driverId },
    ]);
    // The mock point is still stored as evidence
    expect(await db`select seq from location_points where mock order by seq`).toEqual([{ seq: 2 }, { seq: 3 }]);
  });

  it("tracks driver presence and the Last Will", async () => {
    const d = await makeDelivery();
    const ingest = new Ingest(db);
    const topic = topics.driverPresence(d.driverId);
    await ingest.handle(topic, msg({ online: true, t: nowS(), lat: -6.8, lng: 39.27 }));
    expect(await db`select online from driver_presence`).toEqual([{ online: true }]);
    await ingest.handle(topic, msg({ online: false }));
    expect(await db`select online from driver_presence`).toEqual([{ online: false }]);
  });
});

describe("public snapshots", () => {
  it("refreshes at most once per interval and only for active deliveries", async () => {
    const d = await makeDelivery();
    const ingest = new Ingest(db);
    await ingest.handle(topics.deliveryLocation(d.shopId, d.deliveryId), msg({ t: nowS() - 5, lat: -6.8, lng: 39.27, acc: 10, seq: 1 }));
    await ingest.flush();
    expect(await refreshPublicSnapshots(db, 300)).toBe(1);

    await ingest.handle(topics.deliveryLocation(d.shopId, d.deliveryId), msg({ t: nowS(), lat: -6.79, lng: 39.27, acc: 10, seq: 2 }));
    await ingest.flush();
    expect(await refreshPublicSnapshots(db, 300)).toBe(0); // too soon
    expect(await refreshPublicSnapshots(db, 0)).toBe(1);
    const [link] = await db`select snapshot from public_links where token = ${d.token}`;
    expect(link!.snapshot).toMatchObject({ lat: -6.79, lng: 39.27 });

    await db`update deliveries set status = 'DELIVERED', delivered_at = now() where id = ${d.deliveryId}`;
    expect(await refreshPublicSnapshots(db, 0)).toBe(0);
  });
});

describe("outbox relay", () => {
  it("publishes pending rows in order and marks them", async () => {
    await db`insert into outbox (topic, payload) values ('a', ${db.json({ n: 1 })}), ('b', ${db.json({ n: 2 })})`;
    await db`insert into outbox (topic, payload, qos, retain) values ('c', null, 1, true)`;
    const published: [string, string, { qos: number; retain: boolean }][] = [];
    const relay = new OutboxRelay(db, { publish: async (t, p, o) => void published.push([t, p, o]) });

    expect(await relay.drain()).toBe(3);
    expect(published).toEqual([
      ["a", '{"n":1}', { qos: 1, retain: false }],
      ["b", '{"n":2}', { qos: 1, retain: false }],
      ["c", "", { qos: 1, retain: true }],
    ]);
    expect(await db`select count(*)::int as n from outbox where published_at is null`).toEqual([{ n: 0 }]);
    expect(await relay.drain()).toBe(0);
  });

  it("retries the batch if publishing fails", async () => {
    await db`insert into outbox (topic, payload) values ('a', ${db.json({})}), ('b', ${db.json({})})`;
    let fail = true;
    const published: string[] = [];
    const relay = new OutboxRelay(db, {
      publish: async (t) => {
        if (t === "b" && fail) throw new Error("broker down");
        published.push(t);
      },
    });
    await expect(relay.drain()).rejects.toThrow("broker down");
    expect(await db`select count(*)::int as n from outbox where published_at is null`).toEqual([{ n: 2 }]);
    fail = false;
    await relay.drain();
    expect(published).toEqual(["a", "a", "b"]); // at-least-once
  });
});
