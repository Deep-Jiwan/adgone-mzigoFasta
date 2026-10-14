import { describe, expect, it } from "vitest";
import { call, db, expectOk, fixAt, KARIAKOO, lastCode, MIKOCHENI, newUser, post, setIntegrityVerdict, setupDriver, setupShop, upload } from "./helpers";

async function pickedUp() {
  const ops = await newUser({ ops: true });
  const shop = await setupShop();
  const driver = await setupDriver(ops, { deposit: 5000 });
  const d = await post(shop);
  await expectOk(call(driver.user, "POST", `/v1/deliveries/${d.id}/accept`));
  const qr = (await expectOk(call(shop.owner, "GET", `/v1/deliveries/${d.id}`))).pickupQr;
  await expectOk(call(driver.user, "POST", `/v1/deliveries/${d.id}/pickup`, {
    fix: fixAt(KARIAKOO), qr, photoUploadId: await upload(driver.user, "pickup_photo"),
  }));
  return { ops, shop, driver, d };
}

describe("fake GPS", () => {
  it("blocks a checkpoint with a mock fix and keeps the fraud signal", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user, driverId } = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);
    await expectOk(call(user, "POST", `/v1/deliveries/${d.id}/accept`));

    const res = await call(user, "POST", `/v1/deliveries/${d.id}/arrive-pickup`, { fix: fixAt(KARIAKOO, true) });
    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("MOCK_LOCATION");
    const [row] = await db`select status from deliveries where id = ${d.id}`;
    expect(row!.status).toBe("ACCEPTED");
    const signals = await expectOk(call(ops, "GET", "/v1/ops/fraud-signals"));
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ driver_id: driverId, delivery_id: d.id, kind: "mock_location" });
  });

  it("requires the mock flag on every checkpoint fix", async () => {
    const { driver, d } = await pickedUp();
    const { mock: _omit, ...fix } = fixAt(MIKOCHENI);
    const res = await call(driver.user, "POST", `/v1/deliveries/${d.id}/arrive-dropoff`, { fix });
    expect(res.status).toBe(400);
  });

  it("flags a failed integrity check without blocking (policy is Q-37)", async () => {
    const { driver, d } = await pickedUp();
    setIntegrityVerdict("fail");
    await expectOk(call(driver.user, "POST", `/v1/deliveries/${d.id}/arrive-dropoff`, { fix: fixAt(MIKOCHENI), integrity: { token: "x" } }));
    const signals = await db`select kind from fraud_signals`;
    expect(signals.map((s) => s.kind)).toEqual(["integrity_failed"]);
  });
});

describe("pickup QR", () => {
  it("rejects a QR from another delivery", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { user } = await setupDriver(ops, { deposit: 5000 });
    const a = await post(shop);
    const b = await post(shop);
    await expectOk(call(user, "POST", `/v1/deliveries/${a.id}/accept`));
    const res = await call(user, "POST", `/v1/deliveries/${a.id}/pickup`, {
      fix: fixAt(KARIAKOO), qr: b.pickupQr, photoUploadId: await upload(user, "pickup_photo"),
    });
    expect(res.json.error.code).toBe("WRONG_QR");
  });
});

describe("delivery code", () => {
  it("counts wrong codes, locks after five, and records a fraud signal", async () => {
    const { driver, d } = await pickedUp();
    const code = lastCode("+255754000111");
    const wrong = code === "0000" ? "1111" : "0000";
    const photo = await upload(driver.user, "dropoff_photo");
    const attempt = (c: string) => call(driver.user, "POST", `/v1/deliveries/${d.id}/deliver`, { fix: fixAt(MIKOCHENI), code: c, photoUploadId: photo });

    for (let left = 4; left >= 0; left--) {
      const res = await attempt(wrong);
      expect(res.status).toBe(422);
      expect(res.json.error.details.attemptsLeft).toBe(left);
    }
    const locked = await attempt(code);
    expect(locked.status).toBe(423);
    expect((await db`select kind from fraud_signals`).map((s) => s.kind)).toEqual(["code_attempts_exhausted"]);
  });

  it("ops can unlock; a fresh code is sent and works", async () => {
    const { ops, driver, d } = await pickedUp();
    await db`update deliveries set code_attempts = 5 where id = ${d.id}`;
    await expectOk(call(ops, "POST", `/v1/ops/deliveries/${d.id}/unlock-code`));
    const code = lastCode("+255754000111");
    const delivered = await expectOk(call(driver.user, "POST", `/v1/deliveries/${d.id}/deliver`, {
      fix: fixAt(MIKOCHENI), code, photoUploadId: await upload(driver.user, "dropoff_photo"),
    }));
    expect(delivered.status).toBe("DELIVERED");
  });

  it("limits resends", async () => {
    const { shop, d } = await pickedUp();
    await expectOk(call(shop.owner, "POST", `/v1/deliveries/${d.id}/resend-code`));
    await expectOk(call(shop.owner, "POST", `/v1/deliveries/${d.id}/resend-code`));
    const res = await call(shop.owner, "POST", `/v1/deliveries/${d.id}/resend-code`);
    expect(res.status).toBe(429);
  });
});

describe("wallet rules enforced by the database", () => {
  it("never lets a hold exceed the balance", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { driverId } = await setupDriver(ops, { deposit: 1000 });
    const d = await post(shop);
    await expect(db`insert into wallet_holds (driver_id, delivery_id, amount_tzs) values (${driverId}, ${d.id}, 1001)`).rejects.toMatchObject({
      constraint_name: "wallet_never_negative",
    });
  });

  it("charges a delivery's commission once, whatever retries happen", async () => {
    const ops = await newUser({ ops: true });
    const shop = await setupShop();
    const { driverId } = await setupDriver(ops, { deposit: 5000 });
    const d = await post(shop);
    await db`insert into ledger_entries (driver_id, amount_tzs, type, delivery_id) values (${driverId}, -500, 'commission', ${d.id})`;
    await expect(db`insert into ledger_entries (driver_id, amount_tzs, type, delivery_id) values (${driverId}, -500, 'commission', ${d.id})`)
      .rejects.toMatchObject({ constraint_name: "ledger_one_commission_per_delivery" });
  });

  it("keeps the ledger append-only", async () => {
    const ops = await newUser({ ops: true });
    const { driverId } = await setupDriver(ops, { deposit: 5000 });
    await expect(db`update ledger_entries set amount_tzs = 999999 where driver_id = ${driverId}`).rejects.toThrow(/append-only/);
    await expect(db`delete from ledger_entries where driver_id = ${driverId}`).rejects.toThrow(/append-only/);
  });

  it("credits a payment reference once", async () => {
    const ops = await newUser({ ops: true });
    const { driverId } = await setupDriver(ops);
    const body = { amountTzs: 3000, externalRef: "MPESA-QWE123" };
    const first = await call(ops, "POST", `/v1/ops/drivers/${driverId}/deposits`, body);
    const again = await call(ops, "POST", `/v1/ops/drivers/${driverId}/deposits`, body);
    expect([first.status, again.status]).toEqual([201, 200]);
    expect(again.json).toMatchObject({ credited: false, wallet: { balanceTzs: 3000 } });
    const clash = await call(ops, "POST", `/v1/ops/drivers/${driverId}/deposits`, { ...body, amountTzs: 9000 });
    expect(clash.json.error.code).toBe("REFERENCE_USED");
  });

  it("requires a reason and an author for adjustments", async () => {
    const ops = await newUser({ ops: true });
    const { driverId } = await setupDriver(ops);
    await expect(db`insert into ledger_entries (driver_id, amount_tzs, type) values (${driverId}, 1000, 'adjustment')`)
      .rejects.toMatchObject({ constraint_name: "adjustment_has_reason" });
    await expectOk(call(ops, "POST", `/v1/ops/drivers/${driverId}/adjustments`, { amountTzs: 1000, note: "Launch credit" }), 201);
  });
});

describe("access", () => {
  it("hides deliveries from people who have nothing to do with them", async () => {
    const shop = await setupShop();
    const other = await setupShop();
    const d = await post(shop);
    expect((await call(other.owner, "GET", `/v1/deliveries/${d.id}`)).status).toBe(404);
    expect((await call(null, "GET", `/v1/deliveries/${d.id}`)).status).toBe(401);
  });

  it("stops an unassigned driver from acting on someone else's job", async () => {
    const { ops, d } = await pickedUp();
    const stranger = await setupDriver(ops, { deposit: 5000 });
    const res = await call(stranger.user, "POST", `/v1/deliveries/${d.id}/arrive-dropoff`, { fix: fixAt(MIKOCHENI) });
    expect(res.status).toBe(404);
  });

  it("hides ops routes from everyone else", async () => {
    const someone = await newUser();
    expect((await call(someone, "GET", "/v1/ops/drivers")).status).toBe(404);
  });

  it("invited staff get access when they sign in", async () => {
    const shop = await setupShop();
    const staff = await newUser({ phone: "+255688123456" });
    await expectOk(call(shop.owner, "POST", `/v1/shops/${shop.shopId}/members`, { phone: "0688 123 456" }), 201);
    const me = await expectOk(call(staff, "GET", "/v1/me"));
    expect(me.shops).toEqual([{ id: shop.shopId, name: "Duka la Juma", role: "staff" }]);
    await expectOk(call(staff, "POST", "/v1/deliveries", {
      shopId: shop.shopId, pickupLocationId: shop.pickupLocationId, vehicleClass: "boda",
      dropoff: MIKOCHENI, recipient: { name: "Asha", phone: "0754000111" }, goods: { description: "Shoes", declaredValueTzs: 50_000 },
    }), 201);
  });

  it("rejects pins outside Tanzania", async () => {
    const shop = await setupShop();
    const res = await call(shop.owner, "POST", "/v1/deliveries", {
      shopId: shop.shopId, pickupLocationId: shop.pickupLocationId, vehicleClass: "boda",
      dropoff: { lat: 39.2, lng: -6.8 }, recipient: { name: "Asha", phone: "0754000111" }, goods: { description: "Shoes", declaredValueTzs: 1 },
    });
    expect(res.status).toBe(400);
  });
});

describe("public tracking link", () => {
  it("shows minimal information and no phone numbers", async () => {
    const { shop, d } = await pickedUp();
    const token = d.trackingUrl.split("/").at(-1);
    await db`update public_links set snapshot = ${db.json({ lat: -6.8, lng: 39.27, t: "2026-10-14T10:00:00Z" })}, snapshot_at = now() where token = ${token}`;

    const res = await call(null, "GET", `/t/${token}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: "PICKED_UP", shopName: "Duka la Juma", driver: { firstName: "Baraka" }, position: { lat: -6.8, lng: 39.27 } });
    expect(JSON.stringify(res.json)).not.toMatch(/\+255/);
    expect(res.json.driver.plateHint).toMatch(/\*\*\*$/);
    expect(shop).toBeDefined();
  });

  it("returns the same 404 for unknown and malformed tokens", async () => {
    expect((await call(null, "GET", "/t/AAAAAAAAAAAAAAAAAAAAAA")).status).toBe(404);
    expect((await call(null, "GET", "/t/x")).status).toBe(404);
  });

  it("stops showing position after delivery", async () => {
    const { driver, d } = await pickedUp();
    const token = d.trackingUrl.split("/").at(-1);
    await db`update public_links set snapshot = ${db.json({ lat: -6.8, lng: 39.27, t: "2026-10-14T10:00:00Z" })}, snapshot_at = now() where token = ${token}`;
    await expectOk(call(driver.user, "POST", `/v1/deliveries/${d.id}/deliver`, {
      fix: fixAt(MIKOCHENI), code: lastCode("+255754000111"), photoUploadId: await upload(driver.user, "dropoff_photo"),
    }));
    const res = await call(null, "GET", `/t/${token}`);
    expect(res.json).toMatchObject({ status: "DELIVERED", position: null });
  });
});
