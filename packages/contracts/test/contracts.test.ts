import { describe, expect, it } from "vitest";
import {
  aclFor,
  bounds,
  cellAndNeighbours,
  encode,
  jobCellsAround,
  LocationFix,
  parseTopic,
  Presence,
  topics,
  transition,
  TRANSITIONS,
} from "../src";

const SHOP = "8b1f0c1e-7d7a-4d43-9a43-1f3c2c7c6a10";
const DELIVERY = "d5e3a2b1-0000-4000-8000-000000000001";
const DRIVER = "3c9e1d2f-1111-4111-8111-000000000002";

describe("state machine", () => {
  it("allows the happy path in order", () => {
    let status = transition("accept", "OPEN", "driver");
    expect(status).toEqual({ ok: true, to: "ACCEPTED" });
    for (const action of ["arrive_pickup", "pickup", "arrive_dropoff", "deliver"] as const) {
      if (!status.ok) throw new Error("unreachable");
      status = transition(action, status.to, "driver");
      expect(status.ok).toBe(true);
    }
    expect(status).toEqual({ ok: true, to: "DELIVERED" });
  });

  it("rejects the wrong actor before the wrong status", () => {
    expect(transition("accept", "OPEN", "shop")).toEqual({ ok: false, reason: "wrong_actor" });
    expect(transition("deliver", "OPEN", "driver")).toEqual({ ok: false, reason: "wrong_status" });
  });

  it("cannot cancel once goods are picked up", () => {
    expect(transition("cancel", "PICKED_UP", "shop")).toEqual({ ok: false, reason: "wrong_status" });
    expect(transition("fail", "PICKED_UP", "driver")).toEqual({ ok: true, to: "RETURNING" });
  });

  it("every rule has at least one source status and actor", () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(rule.from.length).toBeGreaterThan(0);
      expect(rule.actors.length).toBeGreaterThan(0);
    }
  });
});

describe("geohash", () => {
  it("encodes a known point (Dar es Salaam city centre)", () => {
    const h = encode(-6.816, 39.2803, 5);
    expect(h).toHaveLength(5);
    const b = bounds(h);
    expect(-6.816).toBeGreaterThanOrEqual(b.latMin);
    expect(-6.816).toBeLessThanOrEqual(b.latMax);
    expect(39.2803).toBeGreaterThanOrEqual(b.lngMin);
    expect(39.2803).toBeLessThanOrEqual(b.lngMax);
  });

  it("matches the classic reference value", () => {
    expect(encode(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });

  it("returns the cell and 8 distinct neighbours", () => {
    const cells = cellAndNeighbours("kzf1b");
    expect(cells).toHaveLength(9);
    expect(cells).toContain("kzf1b");
    expect(new Set(cells).size).toBe(9);
  });

  it("jobCellsAround includes the driver's own cell", () => {
    expect(jobCellsAround(-6.79, 39.21)).toContain(encode(-6.79, 39.21, 5));
  });
});

describe("topics", () => {
  it("round-trips every topic kind", () => {
    expect(parseTopic(topics.deliveryLocation(SHOP, DELIVERY))).toEqual({ kind: "deliveryLocation", shopId: SHOP, deliveryId: DELIVERY });
    expect(parseTopic(topics.deliveryLocationBatch(SHOP, DELIVERY))).toEqual({ kind: "deliveryLocationBatch", shopId: SHOP, deliveryId: DELIVERY });
    expect(parseTopic(topics.deliveryEvents(SHOP, DELIVERY))).toEqual({ kind: "deliveryEvents", shopId: SHOP, deliveryId: DELIVERY });
    expect(parseTopic(topics.driverPresence(DRIVER))).toEqual({ kind: "driverPresence", driverId: DRIVER });
    expect(parseTopic(topics.driverInbox(DRIVER))).toEqual({ kind: "driverInbox", driverId: DRIVER });
    expect(parseTopic(topics.jobs("canter", "kzf1b"))).toEqual({ kind: "jobs", vehicleClass: "canter", cell: "kzf1b" });
  });

  it("rejects wildcards and junk", () => {
    expect(() => topics.deliveryLocation("+", DELIVERY)).toThrow();
    expect(() => topics.driverInbox("a/b")).toThrow();
    expect(parseTopic("mf/v1/s/x/d/y/other")).toBeNull();
    expect(parseTopic("mf/v1/jobs/plane/kzf1b")).toBeNull();
    expect(parseTopic("other/v1/drv/x/presence")).toBeNull();
  });
});

describe("messages", () => {
  it("defaults mock to false", () => {
    const fix = LocationFix.parse({ t: 1791398400, lat: -6.79, lng: 39.2, acc: 12, seq: 1 });
    expect(fix.mock).toBe(false);
  });

  it("rejects an out-of-range fix", () => {
    expect(LocationFix.safeParse({ t: 1, lat: -100, lng: 39.2, acc: 12, seq: 1 }).success).toBe(false);
  });

  it("parses the Last Will", () => {
    expect(Presence.parse({ online: false })).toEqual({ online: false });
  });
});

describe("mqtt acl", () => {
  it("a shop may only subscribe under its own shop", () => {
    const rules = aclFor({ role: "shop", shopIds: [SHOP] });
    expect(rules).toEqual([
      { permission: "allow", action: "subscribe", topic: `mf/v1/s/${SHOP}/#` },
      { permission: "deny", action: "all", topic: "#" },
    ]);
  });

  it("a driver on a job may publish that job's location", () => {
    const rules = aclFor({ role: "driver", driverId: DRIVER, vehicleClasses: ["boda"], activeDeliveries: [{ shopId: SHOP, deliveryId: DELIVERY }] });
    expect(rules).toContainEqual({ permission: "allow", action: "publish", topic: topics.deliveryLocation(SHOP, DELIVERY) });
    expect(rules).toContainEqual({ permission: "allow", action: "subscribe", topic: "mf/v1/jobs/boda/+" });
    expect(rules.at(-1)).toEqual({ permission: "deny", action: "all", topic: "#" });
  });
});
