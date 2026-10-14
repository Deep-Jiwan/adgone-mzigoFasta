import { describe, expect, it } from "vitest";
import { encode, topics } from "@mzigo/contracts";
import { call, db, expectOk, fixAt, KARIAKOO, lastCode, MIKOCHENI, newUser, post, sent, setupDriver, setupShop, upload } from "./helpers";

describe("a delivery from post to close", () => {
  it("runs the whole happy path and charges commission exactly once", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user: driver, driverId } = await setupDriver(ops, { deposit: 5000 });

    // Quote and post
    const quote = await expectOk(call(shop.owner, "POST", "/v1/quotes", { vehicleClass: "boda", pickup: KARIAKOO, dropoff: MIKOCHENI }));
    const posted = await post(shop);
    expect(posted.status).toBe("OPEN");
    expect(posted.priceTzs).toBe(quote.priceTzs);
    expect(posted.priceTzs % 500).toBe(0);
    expect(posted.recipient.phone).toBe("+255754000111");
    expect(posted.trackingUrl).toMatch(/^https:\/\/track\.test\/t\/[A-Za-z0-9_-]{22}$/);
    expect(posted.pickupQr).toMatch(/^mf1:/);

    // The offer is queued for the pickup's geohash cell
    const offerTopic = topics.jobs("boda", encode(KARIAKOO.lat, KARIAKOO.lng, 5));
    const queued = await db`select topic, payload from outbox order by id`;
    expect(queued.map((r) => r.topic)).toContain(offerTopic);

    // Driver sees it nearby and can accept it
    const offers = await expectOk(call(driver, "GET", `/v1/offers?lat=${KARIAKOO.lat + 0.01}&lng=${KARIAKOO.lng}`));
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ deliveryId: posted.id, canAccept: true, blockedBy: null });
    const commission = offers[0].commissionTzs;

    // Accept: commission is held, MQTT token now allows publishing this job's location
    const accepted = await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/accept`));
    expect(accepted.delivery.status).toBe("ACCEPTED");
    expect(accepted.delivery.commissionTzs).toBe(commission);
    const acl = JSON.parse(Buffer.from(accepted.realtime.token.split(".")[1], "base64url").toString()).acl;
    expect(acl).toContainEqual({ permission: "allow", action: "publish", topic: topics.deliveryLocation(shop.shopId, posted.id) });
    let wallet = await expectOk(call(driver, "GET", "/v1/drivers/me/wallet"));
    expect(wallet).toMatchObject({ balanceTzs: 5000, heldTzs: commission, availableTzs: 5000 - commission });

    // The shop sees who is coming
    const shopView = await expectOk(call(shop.owner, "GET", `/v1/deliveries/${posted.id}`));
    expect(shopView.driver).toMatchObject({ id: driverId, name: "Baraka Mwita" });
    expect(shopView.commissionTzs).toBeUndefined();

    // Pickup: QR from the shop's screen + photo. Recipient gets the code by SMS.
    await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/arrive-pickup`, { fix: fixAt(KARIAKOO) }));
    const pickupPhoto = await upload(driver, "pickup_photo");
    const picked = await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/pickup`, {
      fix: fixAt(KARIAKOO), qr: shopView.pickupQr, photoUploadId: pickupPhoto,
    }));
    expect(picked.delivery.status).toBe("PICKED_UP");
    expect(picked.codeSms).toBe("sent");
    const code = lastCode("+255754000111");
    expect(sent.at(-1)!.text).toContain(posted.trackingUrl);

    // Delivery with the recipient's code
    await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/arrive-dropoff`, { fix: fixAt(MIKOCHENI) }));
    const dropPhoto = await upload(driver, "dropoff_photo");
    const delivered = await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/deliver`, {
      fix: fixAt(MIKOCHENI), code, photoUploadId: dropPhoto,
    }));
    expect(delivered.status).toBe("DELIVERED");

    // Commission charged once, hold captured, cached totals match the ledger
    wallet = await expectOk(call(driver, "GET", "/v1/drivers/me/wallet"));
    expect(wallet).toMatchObject({ balanceTzs: 5000 - commission, heldTzs: 0, availableTzs: 5000 - commission });
    expect(wallet.entries.map((e: any) => e.type)).toEqual(["commission", "deposit"]);
    expect(await db`select * from wallet_drift`).toHaveLength(0);

    // Audit trail has every step, with checkpoint evidence
    const events = await db`select action, to_status, integrity from delivery_events where delivery_id = ${posted.id} order by id`;
    expect(events.map((e) => e.action)).toEqual(["post", "accept", "arrive_pickup", "pickup", "arrive_dropoff", "deliver"]);
    expect(events[3]!.integrity).toMatchObject({ mock: false, integrity: "unverified" });

    // Both sides rate; the delivery closes
    await expectOk(call(shop.owner, "POST", `/v1/deliveries/${posted.id}/rating`, { stars: 5 }), 201);
    const closed = await expectOk(call(driver, "POST", `/v1/deliveries/${posted.id}/rating`, { stars: 4 }), 201);
    expect(closed.status).toBe("CLOSED");
    const [driverRow] = await db`select rating_avg, rating_count from drivers where id = ${driverId}`;
    expect(driverRow).toMatchObject({ rating_avg: 5, rating_count: 1 });

    // Status events were queued for the bridge, plus a retained "clear" of the live position
    const evtTopic = topics.deliveryEvents(shop.shopId, posted.id);
    const statuses = (await db`select payload from outbox where topic = ${evtTopic} order by id`).map((r) => r.payload.status);
    expect(statuses).toEqual(["OPEN", "ACCEPTED", "AT_PICKUP", "PICKED_UP", "AT_DROPOFF", "DELIVERED", "CLOSED"]);
    const [clear] = await db`select payload, retain from outbox where topic = ${topics.deliveryLocation(shop.shopId, posted.id)}`;
    expect(clear).toMatchObject({ payload: null, retain: true });
  });
});

describe("accepting", () => {
  it("lets exactly one of two racing drivers win", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const a = await setupDriver(ops, { deposit: 5000 });
    const b = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);

    const results = await Promise.all([
      call(a.user, "POST", `/v1/deliveries/${d.id}/accept`),
      call(b.user, "POST", `/v1/deliveries/${d.id}/accept`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.json.error.code).toBe("ALREADY_TAKEN");
    const holds = await db`select driver_id from wallet_holds where delivery_id = ${d.id}`;
    expect(holds).toHaveLength(1);
  });

  it("refuses when the wallet can't cover the commission, and changes nothing", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 100 });
    const d = await post(shop);

    const res = await call(user, "POST", `/v1/deliveries/${d.id}/accept`);
    expect(res.status).toBe(402);
    expect(res.json.error.code).toBe("INSUFFICIENT_BALANCE");
    const [row] = await db`select status, driver_id from deliveries where id = ${d.id}`;
    expect(row).toMatchObject({ status: "OPEN", driver_id: null });
    expect(await db`select * from wallet_holds`).toHaveLength(0);
  });

  it("refuses goods worth more than the driver's tier allows", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop, { goods: { description: "Laptop", declaredValueTzs: 2_000_000 } });

    const offers = await expectOk(call(user, "GET", `/v1/offers?lat=${KARIAKOO.lat}&lng=${KARIAKOO.lng}`));
    expect(offers[0].blockedBy).toBe("VALUE_ABOVE_TIER");
    const res = await call(user, "POST", `/v1/deliveries/${d.id}/accept`);
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("VALUE_ABOVE_TIER");
  });

  it("refuses a second job while one is active", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 10_000 });
    const first = await post(shop);
    const second = await post(shop);
    await expectOk(call(user, "POST", `/v1/deliveries/${first.id}/accept`));
    const res = await call(user, "POST", `/v1/deliveries/${second.id}/accept`);
    expect(res.json.error.code).toBe("DRIVER_BUSY");
  });

  it("refuses pending drivers and the wrong vehicle", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const d = await post(shop);
    const pending = await newUser();
    await expectOk(call(pending, "POST", "/v1/drivers", {
      fullName: "Pending Person", nidaNo: "19900101000000000001", licenceNo: "DL-1", vehicle: { class: "boda", plate: "T 111 AAA" },
    }), 201);
    expect((await call(pending, "POST", `/v1/deliveries/${d.id}/accept`)).json.error.code).toBe("DRIVER_PENDING");

    const canter = await setupDriver(ops, { vehicle: "canter", deposit: 50_000 });
    expect((await call(canter.user, "POST", `/v1/deliveries/${d.id}/accept`)).json.error.code).toBe("WRONG_VEHICLE");
  });
});

describe("cancelling and releasing", () => {
  it("driver release puts the job back on offer and frees the hold", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const a = await setupDriver(ops, { deposit: 5000 });
    const b = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);
    await expectOk(call(a.user, "POST", `/v1/deliveries/${d.id}/accept`));

    const released = await expectOk(call(a.user, "POST", `/v1/deliveries/${d.id}/release`, { reason: "Bike broke down" }));
    expect(released).toEqual({ id: d.id, status: "OPEN" });
    expect((await expectOk(call(shop.owner, "GET", `/v1/deliveries/${d.id}`))).driver).toBeNull();
    expect((await call(a.user, "GET", `/v1/deliveries/${d.id}`)).status).toBe(404);
    expect((await expectOk(call(a.user, "GET", "/v1/drivers/me/wallet"))).heldTzs).toBe(0);

    // Someone else can take it now
    await expectOk(call(b.user, "POST", `/v1/deliveries/${d.id}/accept`));
    expect(await db`select status from wallet_holds where delivery_id = ${d.id} order by created_at`).toEqual([
      { status: "released" },
      { status: "held" },
    ]);
  });

  it("shop cancel after accept releases the hold and stops tracking", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);
    await expectOk(call(user, "POST", `/v1/deliveries/${d.id}/accept`));

    const cancelled = await expectOk(call(shop.owner, "POST", `/v1/deliveries/${d.id}/cancel`, { reason: "Customer changed mind" }));
    expect(cancelled.status).toBe("CANCELLED");
    expect((await expectOk(call(user, "GET", "/v1/drivers/me/wallet"))).heldTzs).toBe(0);
    const [link] = await db`select expires_at from public_links where delivery_id = ${d.id}`;
    expect(link!.expires_at).not.toBeNull();
  });

  it("can't cancel once picked up; it must be failed and returned", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);
    await expectOk(call(user, "POST", `/v1/deliveries/${d.id}/accept`));
    const qr = (await expectOk(call(shop.owner, "GET", `/v1/deliveries/${d.id}`))).pickupQr;
    await expectOk(call(user, "POST", `/v1/deliveries/${d.id}/pickup`, { fix: fixAt(KARIAKOO), qr, photoUploadId: await upload(user, "pickup_photo") }));

    const res = await call(shop.owner, "POST", `/v1/deliveries/${d.id}/cancel`, { reason: "Too late" });
    expect(res.status).toBe(409);

    await expectOk(call(user, "POST", `/v1/deliveries/${d.id}/fail`, { reason: "Recipient not answering", fix: fixAt(MIKOCHENI) }));
    const returned = await expectOk(call(shop.owner, "POST", `/v1/deliveries/${d.id}/confirm-return`));
    expect(returned.status).toBe("RETURNED");
    const wallet = await expectOk(call(user, "GET", "/v1/drivers/me/wallet"));
    expect(wallet).toMatchObject({ balanceTzs: 5000, heldTzs: 0 });
  });
});

describe("expiry", () => {
  it("expires open jobs past their window and withdraws the offer", async () => {
    const { runScheduled } = await import("../src/services/deliveries");
    const { deps } = await import("./helpers");
    const shop = await setupShop();
    const d = await post(shop);
    await db`update deliveries set offer_expires_at = now() - interval '1 minute' where id = ${d.id}`;

    expect(await runScheduled(deps)).toEqual({ expired: 1, closed: 0 });
    const [row] = await db`select status from deliveries where id = ${d.id}`;
    expect(row!.status).toBe("EXPIRED");
    const withdrawn = await db`select payload from outbox where payload->>'type' = 'job.withdrawn'`;
    expect(withdrawn[0]!.payload).toMatchObject({ deliveryId: d.id, reason: "expired" });
  });
});
