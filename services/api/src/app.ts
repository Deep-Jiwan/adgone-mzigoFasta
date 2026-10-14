import { Hono } from "hono";
import { z } from "zod";
import { ApiError, fromPgError } from "./lib/errors";
import { body, parse } from "./lib/validate";
import type { Deps } from "./ports";
import { claimInvites, ensureUser, requireOps, type CurrentUser } from "./services/access";
import * as deliveries from "./services/deliveries";
import * as drivers from "./services/drivers";
import { grantFor, issueMqttToken } from "./services/realtime";
import * as shops from "./services/shops";
import { publicTracking } from "./services/tracking";
import { getUpload, putUpload, UploadKindInput } from "./services/uploads";
import * as wallet from "./services/wallet";

type Env = { Variables: { user: CurrentUser } };

const Id = z.uuid();

export function createApp(deps: Deps) {
  const app = new Hono<Env>();
  const { db } = deps;

  app.onError((err, c) => {
    const known = err instanceof ApiError ? err : fromPgError(err);
    if (known) {
      return c.json({ error: { code: known.code, message: known.message, details: known.details } }, known.status);
    }
    console.error("unhandled error", c.req.method, c.req.path, err);
    return c.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // Public tracking page data. No auth; rate-limited at the edge (ARCHITECTURE.md §3.1).
  app.get("/t/:token", async (c) => {
    const data = await publicTracking(deps, c.req.param("token"));
    c.header("Cache-Control", "public, max-age=60");
    return c.json(data);
  });

  // --- everything below needs a signed-in user ------------------------------
  const v1 = new Hono<Env>();

  v1.use("*", async (c, next) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Sign in first");
    let auth;
    try {
      auth = await deps.auth.verify(token);
    } catch {
      throw new ApiError(401, "UNAUTHENTICATED", "Session is invalid or expired");
    }
    c.set("user", await ensureUser(db, auth));
    await next();
  });

  const id = (c: { req: { param: (k: string) => string } }) => parse(Id, c.req.param("id"));

  // Me
  v1.get("/me", async (c) => {
    const user = c.get("user");
    await claimInvites(db, user.id, user.phone);
    const memberships = await db`
      select m.shop_id, m.role, s.name from shop_members m join shops s on s.id = m.shop_id where m.user_id = ${user.id}`;
    return c.json({
      id: user.id,
      phone: user.phone,
      isOps: user.isOps,
      shops: memberships.map((m) => ({ id: m.shop_id, name: m.name, role: m.role })),
      driver: await drivers.myDriverProfile(deps, user),
    });
  });

  // Uploads: raw body, ?kind=
  v1.put("/uploads", async (c) => {
    const { kind } = parse(UploadKindInput, c.req.query());
    const result = await putUpload(deps, c.get("user"), kind, c.req.header("Content-Type") ?? "", await c.req.arrayBuffer());
    return c.json(result, 201);
  });
  v1.get("/uploads/:id", async (c) => {
    const object = await getUpload(deps, c.get("user"), id(c));
    return new Response(object.body, { headers: { "Content-Type": object.contentType, "Cache-Control": "private, max-age=3600" } });
  });

  // Shops
  v1.post("/shops", async (c) => c.json(await shops.createShop(deps, c.get("user"), await body(c, shops.CreateShopInput)), 201));
  v1.get("/shops/:id", async (c) => c.json(await shops.getShop(deps, c.get("user"), id(c))));
  v1.post("/shops/:id/members", async (c) =>
    c.json(await shops.inviteMember(deps, c.get("user"), id(c), await body(c, shops.InviteInput)), 201));
  v1.post("/shops/:id/pickup-locations", async (c) =>
    c.json(await shops.createPickupLocation(deps, c.get("user"), id(c), await body(c, shops.PickupLocationInput)), 201));

  // Drivers
  v1.post("/drivers", async (c) =>
    c.json(await drivers.registerDriver(deps, c.get("user"), await body(c, drivers.RegisterDriverInput)), 201));
  v1.get("/drivers/me/wallet", async (c) => {
    const driverId = await drivers.requireDriverId(deps, c.get("user"));
    return c.json(await wallet.walletDetails(db, driverId));
  });
  v1.get("/offers", async (c) =>
    c.json(await deliveries.nearbyOffers(deps, c.get("user"), parse(deliveries.NearbyInput, c.req.query()))));

  // Deliveries
  v1.post("/quotes", async (c) => c.json(await deliveries.quote(deps, await body(c, deliveries.QuoteInput))));
  v1.post("/deliveries", async (c) =>
    c.json(await deliveries.postDelivery(deps, c.get("user"), await body(c, deliveries.PostDeliveryInput)), 201));
  v1.get("/deliveries", async (c) =>
    c.json(await deliveries.list(deps, c.get("user"), parse(deliveries.ListInput, c.req.query()))));
  v1.get("/deliveries/:id", async (c) => c.json(await deliveries.view(deps, c.get("user"), id(c))));

  const optionalBody = async <T extends z.ZodType>(c: Parameters<typeof body>[0], schema: T) =>
    (c.req.header("Content-Length") ?? "0") === "0" && !c.req.header("Transfer-Encoding") ? parse(schema, undefined) : body(c, schema);

  v1.post("/deliveries/:id/accept", async (c) =>
    c.json(await deliveries.accept(deps, c.get("user"), id(c), await optionalBody(c, deliveries.AcceptInput))));
  v1.post("/deliveries/:id/arrive-pickup", async (c) =>
    c.json(await deliveries.arrivePickup(deps, c.get("user"), id(c), await body(c, deliveries.ArriveInput))));
  v1.post("/deliveries/:id/pickup", async (c) =>
    c.json(await deliveries.pickup(deps, c.get("user"), id(c), await body(c, deliveries.PickupInput))));
  v1.post("/deliveries/:id/arrive-dropoff", async (c) =>
    c.json(await deliveries.arriveDropoff(deps, c.get("user"), id(c), await body(c, deliveries.ArriveInput))));
  v1.post("/deliveries/:id/deliver", async (c) =>
    c.json(await deliveries.deliver(deps, c.get("user"), id(c), await body(c, deliveries.DeliverInput))));
  v1.post("/deliveries/:id/release", async (c) =>
    c.json(await deliveries.release(deps, c.get("user"), id(c), await body(c, deliveries.ReasonInput))));
  v1.post("/deliveries/:id/cancel", async (c) =>
    c.json(await deliveries.cancel(deps, c.get("user"), id(c), await body(c, deliveries.ReasonInput))));
  v1.post("/deliveries/:id/fail", async (c) =>
    c.json(await deliveries.fail(deps, c.get("user"), id(c), await body(c, deliveries.FailInput))));
  v1.post("/deliveries/:id/confirm-return", async (c) =>
    c.json(await deliveries.confirmReturn(deps, c.get("user"), id(c))));
  v1.post("/deliveries/:id/resend-code", async (c) =>
    c.json(await deliveries.resendCode(deps, c.get("user"), id(c))));
  v1.post("/deliveries/:id/rating", async (c) =>
    c.json(await deliveries.rate(deps, c.get("user"), id(c), await body(c, deliveries.RateInput)), 201));

  // Realtime: MQTT broker token
  v1.post("/realtime/token", async (c) => {
    const { as } = await body(c, z.object({ as: z.enum(["driver", "shop", "ops"]) }));
    const user = c.get("user");
    return c.json(await issueMqttToken(deps, user.id, await grantFor(db, user, as)));
  });

  // Ops
  const ops = new Hono<Env>();
  ops.use("*", async (c, next) => {
    requireOps(c.get("user"));
    await next();
  });
  ops.get("/drivers", async (c) => c.json(await drivers.listDrivers(deps, c.get("user"), parse(drivers.ListDriversInput, c.req.query()))));
  ops.post("/drivers/:id/approve", async (c) =>
    c.json(await drivers.approveDriver(deps, c.get("user"), id(c), await optionalBody(c, drivers.ApproveInput))));
  ops.post("/drivers/:id/suspend", async (c) =>
    c.json(await drivers.suspendDriver(deps, c.get("user"), id(c), await body(c, drivers.SuspendInput))));
  ops.get("/drivers/:id/wallet", async (c) => c.json(await wallet.walletDetails(db, id(c))));
  // Manual mobile-money reconciliation for the pilot (Q-19). Idempotent per externalRef.
  ops.post("/drivers/:id/deposits", async (c) => {
    const input = await body(c, z.object({
      amountTzs: z.number().int().positive().max(10_000_000),
      externalRef: z.string().trim().min(4).max(100),
      note: z.string().trim().max(300).optional(),
    }));
    const result = await wallet.creditDeposit(db, { driverId: id(c), createdBy: c.get("user").id, ...input });
    return c.json({ ...result, wallet: await wallet.walletOf(db, id(c)) }, result.credited ? 201 : 200);
  });
  ops.post("/drivers/:id/adjustments", async (c) => {
    const input = await body(c, z.object({
      amountTzs: z.number().int().refine((n) => n !== 0, "must not be zero"),
      note: z.string().trim().min(5).max(300),
    }));
    await wallet.adjust(db, { driverId: id(c), createdBy: c.get("user").id, ...input });
    return c.json(await wallet.walletOf(db, id(c)), 201);
  });
  ops.get("/fraud-signals", async (c) => {
    const rows = await db`
      select id, driver_id, delivery_id, kind, at, details from fraud_signals
       where reviewed_at is null order by at desc limit 200`;
    return c.json(rows);
  });
  ops.post("/fraud-signals/:signalId/review", async (c) => {
    const signalId = parse(z.coerce.number().int().positive(), c.req.param("signalId"));
    const { outcome } = await body(c, z.object({ outcome: z.string().trim().min(3).max(300) }));
    const [row] = await db`
      update fraud_signals set reviewed_by = ${c.get("user").id}, reviewed_at = now(), outcome = ${outcome}
       where id = ${signalId} and reviewed_at is null returning id`;
    if (!row) throw new ApiError(404, "NOT_FOUND", "signal not found or already reviewed");
    return c.json({ ok: true });
  });
  ops.post("/deliveries/:id/unlock-code", async (c) => c.json(await deliveries.unlockCode(deps, c.get("user"), id(c))));
  ops.get("/wallet-drift", async (c) => c.json(await db`select * from wallet_drift`));

  v1.route("/ops", ops);
  app.route("/v1", v1);
  return app;
}

