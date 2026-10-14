/**
 * The delivery lifecycle. Every status change:
 *   1. locks the delivery row (so two requests can't both win),
 *   2. checks the move against the shared state machine in @mzigo/contracts,
 *   3. writes the change, an audit event and the outbox messages in ONE transaction.
 * The bridge then announces it over MQTT.
 */
import {
  ACTIVE_STATUSES,
  transition,
  TRANSITIONS,
  VEHICLE_CLASSES,
  type Actor,
  type DeliveryAction,
  type DeliveryStatus,
  type VehicleClass,
} from "@mzigo/contracts";
import { z } from "zod";
import { hmacBase64Url, hmacHex, randomCode, randomToken, timingSafeEqual } from "../lib/crypto";
import { point, type Q, type Tx } from "../lib/db";
import { ApiError, notFound } from "../lib/errors";
import { CheckpointFix, TzPlace } from "../lib/geo";
import { TzPhone } from "../lib/phone";
import type { Deps } from "../ports";
import { driverFor, requireApprovedDriver, requireShopMember, shopRole, type CurrentUser } from "./access";
import { recordFraudSignal } from "./fraud";
import {
  enqueueClearLiveLocation,
  enqueueOffer,
  enqueueStatus,
  enqueueWithdrawn,
  type OfferSource,
} from "./outbox";
import { commissionFor, estimatedRoadKm, priceFor, pricingRule } from "./pricing";
import { grantFor, issueMqttToken } from "./realtime";
import { captureCommission, holdCommission, releaseHold, walletOf } from "./wallet";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface DeliveryRow extends OfferSource {
  shop_id: string;
  pickup_location_id: string;
  driver_id: string | null;
  status: DeliveryStatus;
  dropoff_landmark: string | null;
  recipient_name: string;
  recipient_phone: string;
  goods_description: string;
  commission_tzs: number | null;
  code_hash: string | null;
  code_attempts: number;
  code_sends: number;
  posted_at: Date;
  accepted_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
}

const COLUMNS = (q: Q) => q`
  d.id, d.shop_id, d.pickup_location_id, d.driver_id, d.vehicle_class, d.status,
  ST_Y(d.pickup_pin::geometry) as pickup_lat, ST_X(d.pickup_pin::geometry) as pickup_lng, d.pickup_landmark,
  ST_Y(d.dropoff_pin::geometry) as dropoff_lat, ST_X(d.dropoff_pin::geometry) as dropoff_lng, d.dropoff_landmark,
  d.recipient_name, d.recipient_phone, d.goods_description, d.declared_value_tzs,
  d.distance_km, d.price_tzs, d.tip_tzs, d.commission_tzs, d.code_hash, d.code_attempts, d.code_sends,
  d.offer_expires_at, d.posted_at, d.accepted_at, d.picked_up_at, d.delivered_at`;

async function load(q: Q, id: string, lock = false): Promise<DeliveryRow> {
  const rows = lock
    ? await q<DeliveryRow[]>`select ${COLUMNS(q)} from deliveries d where d.id = ${id} for update`
    : await q<DeliveryRow[]>`select ${COLUMNS(q)} from deliveries d where d.id = ${id}`;
  if (!rows[0]) throw notFound("delivery");
  return rows[0];
}

// ---------------------------------------------------------------------------
// Who is acting?
// ---------------------------------------------------------------------------

interface ActingAs {
  actor: Actor;
  driverId: string | null;
}

/**
 * Works out in which capacity the user acts on this delivery for this action. People with no
 * relation to the delivery get 404, so delivery ids can't be probed.
 */
async function actingAs(q: Q, user: CurrentUser, d: DeliveryRow, action: DeliveryAction): Promise<ActingAs> {
  const allowed = TRANSITIONS[action].actors;
  const driver = await driverFor(q, user.id);
  const isAssignedDriver = !!driver && driver.id === d.driver_id;
  const isMember = !!(await shopRole(q, user.id, d.shop_id));

  if (allowed.includes("driver") && isAssignedDriver) return { actor: "driver", driverId: driver.id };
  if (allowed.includes("shop") && isMember) return { actor: "shop", driverId: null };
  if (allowed.includes("ops") && user.isOps) return { actor: "ops", driverId: null };
  if (isAssignedDriver || isMember || user.isOps) {
    throw new ApiError(403, "WRONG_ACTOR", `You can't ${action.replace("_", " ")} this delivery`);
  }
  throw notFound("delivery");
}

// ---------------------------------------------------------------------------
// Applying a transition
// ---------------------------------------------------------------------------

interface EventExtras {
  userId: string | null;
  pin?: { lat: number; lng: number } | null;
  deviceAt?: Date | null;
  payload?: Record<string, unknown>;
  integrity?: Record<string, unknown> | null;
}

async function applyTransition(tx: Tx, d: DeliveryRow, action: DeliveryAction, actor: Actor, extras: EventExtras) {
  const result = transition(action, d.status, actor);
  if (!result.ok) {
    if (action === "accept") throw new ApiError(409, "ALREADY_TAKEN", "Another driver already took this job");
    throw new ApiError(409, "INVALID_STATE", `Can't ${action.replace("_", " ")} a delivery that is ${d.status}`, {
      status: d.status,
    });
  }
  await tx`update deliveries set status = ${result.to} where id = ${d.id}`;
  const [event] = await tx<{ id: number; at: Date }[]>`
    insert into delivery_events (delivery_id, action, from_status, to_status, actor_role, actor_user_id, device_at, pin, payload, integrity)
    values (${d.id}, ${action}, ${d.status}, ${result.to}, ${actor}, ${extras.userId},
            ${extras.deviceAt ?? null}, ${extras.pin ? point(tx, extras.pin) : null},
            ${tx.json((extras.payload ?? {}) as never)}, ${extras.integrity ? tx.json(extras.integrity as never) : null})
    returning id, at`;
  await enqueueStatus(tx, d, event!.id, action, result.to, event!.at);
  return { to: result.to, eventId: event!.id };
}

// ---------------------------------------------------------------------------
// Checkpoint evidence (fake GPS, device integrity)
// ---------------------------------------------------------------------------

export const IntegrityInput = z.object({ token: z.string().max(10_000).optional(), appVersion: z.string().max(40).optional() }).optional();

/**
 * Blocks a checkpoint when the phone reports a mock (fake GPS) fix, and records a fraud signal
 * that survives the rejection. Returns the evidence to store on the audit event.
 */
async function checkpointEvidence(
  deps: Deps,
  driverId: string,
  deliveryId: string,
  action: DeliveryAction,
  fix: CheckpointFix | undefined,
  integrity: z.infer<typeof IntegrityInput>,
) {
  if (fix?.mock) {
    await recordFraudSignal(deps.db, {
      driverId,
      deliveryId,
      kind: "mock_location",
      details: { action, lat: fix.lat, lng: fix.lng, acc: fix.acc, t: fix.t },
    });
    throw new ApiError(422, "MOCK_LOCATION", "Turn off any fake GPS app to continue");
  }
  const check = await deps.integrity.verify(integrity?.token);
  if (check.verdict === "fail") {
    // Policy for failed integrity is Q-37; for now we flag and continue.
    await recordFraudSignal(deps.db, { driverId, deliveryId, kind: "integrity_failed", details: { action, ...check.details } });
  }
  return {
    mock: fix?.mock ?? null,
    accuracyM: fix?.acc ?? null,
    integrity: check.verdict,
    appVersion: integrity?.appVersion ?? null,
  };
}

const deviceTime = (fix?: CheckpointFix) => (fix ? new Date(fix.t * 1000) : null);

// ---------------------------------------------------------------------------
// Uploads attached to checkpoints
// ---------------------------------------------------------------------------

async function attachUpload(tx: Tx, uploadId: string, userId: string, kind: string, deliveryId: string) {
  const [u] = await tx<{ id: string }[]>`
    update uploads set delivery_id = ${deliveryId}
     where id = ${uploadId} and owner_user_id = ${userId} and kind = ${kind}
       and (delivery_id is null or delivery_id = ${deliveryId})
    returning id`;
  if (!u) throw new ApiError(422, "UPLOAD_NOT_FOUND", `Upload ${uploadId} is not a ${kind} you uploaded`);
}

// ---------------------------------------------------------------------------
// Pickup QR and delivery code
// ---------------------------------------------------------------------------

/** What the shop's screen shows as a QR code; the driver scans it at pickup. */
export async function pickupQr(deps: Deps, deliveryId: string): Promise<string> {
  const mac = await hmacBase64Url(deps.config.codeSecret, `pickup:${deliveryId}`);
  return `mf1:${deliveryId}:${mac.slice(0, 16)}`;
}

const codeHash = (deps: Deps, deliveryId: string, code: string) => hmacHex(deps.config.codeSecret, `code:${deliveryId}:${code}`);

function codeSmsText(shopName: string, code: string, trackingUrl: string): string {
  // Swahili first (PLAN.md §7). Draft wording: have a native speaker review before launch.
  return `${shopName}: Mzigo wako uko njiani. Namba ya kupokea: ${code}. Mpe dereva namba hii tu ukishapokea mzigo. Fuatilia: ${trackingUrl}`;
}

async function sendCode(deps: Deps, d: DeliveryRow, code: string): Promise<"sent" | "failed"> {
  const [info] = await deps.db<{ shop_name: string; token: string }[]>`
    select s.name as shop_name, l.token from shops s join public_links l on l.delivery_id = ${d.id} where s.id = ${d.shop_id}`;
  try {
    await deps.sms.send(d.recipient_phone, codeSmsText(info!.shop_name, code, trackingUrl(deps, info!.token)));
    return "sent";
  } catch (err) {
    console.error("delivery code SMS failed", d.id, err);
    return "failed";
  }
}

export const trackingUrl = (deps: Deps, token: string) => `${deps.config.publicTrackingBaseUrl.replace(/\/$/, "")}/${token}`;

// ---------------------------------------------------------------------------
// Quotes and posting
// ---------------------------------------------------------------------------

export const QuoteInput = z.object({
  vehicleClass: z.enum(VEHICLE_CLASSES),
  pickup: TzPlace,
  dropoff: TzPlace,
});

export async function quote(deps: Deps, input: z.infer<typeof QuoteInput>) {
  const rule = await pricingRule(deps.db, input.vehicleClass);
  const distanceKm = estimatedRoadKm(input.pickup, input.dropoff);
  return { vehicleClass: input.vehicleClass, distanceKm, priceTzs: priceFor(rule, distanceKm) };
}

export const PostDeliveryInput = z.object({
  shopId: z.uuid(),
  pickupLocationId: z.uuid(),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  dropoff: TzPlace,
  recipient: z.object({ name: z.string().trim().min(1).max(120), phone: TzPhone }),
  goods: z.object({
    description: z.string().trim().min(2).max(500),
    declaredValueTzs: z.number().int().min(0).max(1_000_000_000),
  }),
  tipTzs: z.number().int().min(0).max(1_000_000).default(0),
});

export async function postDelivery(deps: Deps, user: CurrentUser, input: z.infer<typeof PostDeliveryInput>) {
  const { db } = deps;
  await requireShopMember(db, user, input.shopId);
  const [loc] = await db<{ lat: number; lng: number; landmark: string | null }[]>`
    select ST_Y(pin::geometry) as lat, ST_X(pin::geometry) as lng, landmark
      from pickup_locations
     where id = ${input.pickupLocationId} and shop_id = ${input.shopId} and archived_at is null`;
  if (!loc) throw new ApiError(422, "PICKUP_LOCATION_NOT_FOUND", "Pickup location not found for this shop");

  const rule = await pricingRule(db, input.vehicleClass);
  const distanceKm = estimatedRoadKm(loc, input.dropoff);
  const priceTzs = priceFor(rule, distanceKm);
  const token = randomToken();

  const id = await db.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into deliveries (
        shop_id, pickup_location_id, vehicle_class, pickup_pin, pickup_landmark, dropoff_pin, dropoff_landmark,
        recipient_name, recipient_phone, goods_description, declared_value_tzs,
        distance_km, price_tzs, tip_tzs, offer_expires_at, posted_by)
      values (
        ${input.shopId}, ${input.pickupLocationId}, ${input.vehicleClass}, ${point(tx, loc)}, ${loc.landmark},
        ${point(tx, input.dropoff)}, ${input.dropoff.landmark ?? null},
        ${input.recipient.name}, ${input.recipient.phone}, ${input.goods.description}, ${input.goods.declaredValueTzs},
        ${distanceKm}, ${priceTzs}, ${input.tipTzs},
        now() + make_interval(mins => ${deps.config.offerTtlMinutes}), ${user.id})
      returning id`;
    const d = await load(tx, row!.id);
    await tx`insert into public_links (token, delivery_id) values (${token}, ${d.id})`;
    const [event] = await tx<{ id: number; at: Date }[]>`
      insert into delivery_events (delivery_id, action, to_status, actor_role, actor_user_id)
      values (${d.id}, 'post', 'OPEN', 'shop', ${user.id}) returning id, at`;
    await enqueueStatus(tx, d, event!.id, "post", "OPEN", event!.at);
    await enqueueOffer(tx, d);
    return d.id;
  });
  return view(deps, user, id);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A delivery as the given user may see it. */
export async function view(deps: Deps, user: CurrentUser, id: string) {
  const { db } = deps;
  const d = await load(db, id);
  const driver = await driverFor(db, user.id);
  const isAssignedDriver = !!driver && driver.id === d.driver_id;
  const isMember = !!(await shopRole(db, user.id, d.shop_id));
  if (!isAssignedDriver && !isMember && !user.isOps) throw notFound("delivery");

  const [extra] = await db<{
    shop_name: string; shop_phone: string; storefront_photo_id: string; token: string;
    driver_name: string | null; driver_phone: string | null; driver_rating: number | null;
    plate: string | null;
  }[]>`
    select s.name as shop_name, s.phone as shop_phone, pl.storefront_photo_id, l.token,
           dr.full_name as driver_name, du.phone as driver_phone, dr.rating_avg as driver_rating,
           (select v.plate from vehicles v where v.driver_id = dr.id and v.class = ${d.vehicle_class} and v.active limit 1) as plate
      from shops s
      join pickup_locations pl on pl.id = ${d.pickup_location_id}
      join public_links l on l.delivery_id = ${d.id}
      left join drivers dr on dr.id = ${d.driver_id}
      left join users du on du.id = dr.user_id
     where s.id = ${d.shop_id}`;
  const e = extra!;
  const seesShopSide = isMember || user.isOps;

  return {
    id: d.id,
    shopId: d.shop_id,
    shop: { name: e.shop_name, phone: e.shop_phone },
    status: d.status,
    vehicleClass: d.vehicle_class,
    pickup: {
      locationId: d.pickup_location_id,
      lat: d.pickup_lat,
      lng: d.pickup_lng,
      landmark: d.pickup_landmark,
      storefrontPhotoId: e.storefront_photo_id,
    },
    dropoff: { lat: d.dropoff_lat, lng: d.dropoff_lng, landmark: d.dropoff_landmark },
    recipient: { name: d.recipient_name, phone: d.recipient_phone },
    goods: { description: d.goods_description, declaredValueTzs: d.declared_value_tzs },
    distanceKm: d.distance_km,
    priceTzs: d.price_tzs,
    tipTzs: d.tip_tzs,
    commissionTzs: isAssignedDriver || user.isOps ? d.commission_tzs : undefined,
    driver: d.driver_id
      ? { id: d.driver_id, name: e.driver_name, phone: e.driver_phone, rating: e.driver_rating, plate: e.plate }
      : null,
    offerExpiresAt: d.offer_expires_at,
    postedAt: d.posted_at,
    acceptedAt: d.accepted_at,
    pickedUpAt: d.picked_up_at,
    deliveredAt: d.delivered_at,
    codeLocked: d.code_attempts >= deps.config.maxCodeAttempts,
    trackingUrl: seesShopSide ? trackingUrl(deps, e.token) : undefined,
    pickupQr: seesShopSide && ["OPEN", "ACCEPTED", "AT_PICKUP"].includes(d.status) ? await pickupQr(deps, d.id) : undefined,
  };
}

export const ListInput = z.object({
  shopId: z.uuid().optional(),
  as: z.enum(["shop", "driver"]).default("shop"),
  status: z.enum(["active", "finished", "all"]).default("all"),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function list(deps: Deps, user: CurrentUser, input: z.infer<typeof ListInput>) {
  const { db } = deps;
  let owner;
  if (input.as === "driver") {
    const driver = await driverFor(db, user.id);
    if (!driver) throw new ApiError(403, "NOT_A_DRIVER", "Register as a driver first");
    owner = db`d.driver_id = ${driver.id}`;
  } else {
    if (!input.shopId) throw new ApiError(400, "SHOP_REQUIRED", "shopId is required");
    await requireShopMember(db, user, input.shopId);
    owner = db`d.shop_id = ${input.shopId}`;
  }
  // Arrays are passed as IN lists: with fetch_types off (needed for Hyperdrive) postgres.js
  // can't serialise array parameters of custom types.
  const active = [...ACTIVE_STATUSES, "OPEN"];
  const statusFilter =
    input.status === "active" ? db`and d.status in ${db(active)}`
    : input.status === "finished" ? db`and d.status not in ${db(active)}`
    : db``;
  const before = input.before ? db`and d.posted_at < ${input.before}` : db``;
  const rows = await db<DeliveryRow[]>`
    select ${COLUMNS(db)} from deliveries d
     where ${owner} ${statusFilter} ${before}
     order by d.posted_at desc limit ${input.limit}`;
  return rows.map((d) => ({
    id: d.id,
    status: d.status,
    vehicleClass: d.vehicle_class,
    pickupLandmark: d.pickup_landmark,
    dropoffLandmark: d.dropoff_landmark,
    recipientName: d.recipient_name,
    priceTzs: d.price_tzs + d.tip_tzs,
    postedAt: d.posted_at,
    deliveredAt: d.delivered_at,
  }));
}

export const NearbyInput = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(30).default(8),
});

/** Open jobs near a driver, for the app's list. Live updates arrive over MQTT. */
export async function nearbyOffers(deps: Deps, user: CurrentUser, input: z.infer<typeof NearbyInput>) {
  const { db } = deps;
  const driver = await requireApprovedDriver(db, user);
  if (driver.vehicleClasses.length === 0) return [];
  const [tier] = await db<{ max_declared_value_tzs: number }[]>`select max_declared_value_tzs from driver_tiers where tier = ${driver.tier}`;
  const wallet = await walletOf(db, driver.id);
  const here = point(db, input);
  const rows = await db<(DeliveryRow & { to_pickup_km: number })[]>`
    select ${COLUMNS(db)}, ST_Distance(d.pickup_pin, ${here}) / 1000 as to_pickup_km
      from deliveries d
     where d.status = 'OPEN' and d.offer_expires_at > now()
       and d.vehicle_class in ${db(driver.vehicleClasses)}
       and ST_DWithin(d.pickup_pin, ${here}, ${input.radiusKm * 1000})
     order by to_pickup_km limit 50`;
  const rules = new Map<VehicleClass, Awaited<ReturnType<typeof pricingRule>>>();
  const out = [];
  for (const d of rows) {
    if (!rules.has(d.vehicle_class)) rules.set(d.vehicle_class, await pricingRule(db, d.vehicle_class));
    const commission = commissionFor(rules.get(d.vehicle_class)!, d.price_tzs);
    const withinTier = d.declared_value_tzs <= (tier?.max_declared_value_tzs ?? 0);
    const canAfford = wallet.availableTzs >= commission;
    out.push({
      deliveryId: d.id,
      vehicleClass: d.vehicle_class,
      pickup: { lat: d.pickup_lat, lng: d.pickup_lng, landmark: d.pickup_landmark },
      dropoffArea: { lat: Math.round(d.dropoff_lat * 1000) / 1000, lng: Math.round(d.dropoff_lng * 1000) / 1000 },
      distanceKm: d.distance_km,
      toPickupKm: Math.round(d.to_pickup_km * 10) / 10,
      priceTzs: d.price_tzs + d.tip_tzs,
      commissionTzs: commission,
      declaredValueTzs: d.declared_value_tzs,
      expiresAt: d.offer_expires_at,
      canAccept: withinTier && canAfford,
      blockedBy: !withinTier ? "VALUE_ABOVE_TIER" : !canAfford ? "INSUFFICIENT_BALANCE" : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Driver actions
// ---------------------------------------------------------------------------

export const AcceptInput = z.object({ fix: CheckpointFix.optional(), integrity: IntegrityInput }).default({});

export async function accept(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof AcceptInput>) {
  const { db } = deps;
  const driver = await requireApprovedDriver(db, user);
  const evidence = await checkpointEvidence(deps, driver.id, id, "accept", input.fix, input.integrity);

  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    if (!driver.vehicleClasses.includes(d.vehicle_class)) {
      throw new ApiError(403, "WRONG_VEHICLE", `This job needs a ${d.vehicle_class}`);
    }
    if (d.status === "OPEN" && d.offer_expires_at.getTime() <= Date.now()) {
      throw new ApiError(410, "OFFER_EXPIRED", "This job has expired");
    }
    const [tier] = await tx<{ max_declared_value_tzs: number }[]>`
      select max_declared_value_tzs from driver_tiers where tier = ${driver.tier}`;
    if (d.status === "OPEN" && d.declared_value_tzs > (tier?.max_declared_value_tzs ?? 0)) {
      throw new ApiError(403, "VALUE_ABOVE_TIER", "Goods are worth more than your tier allows", {
        maxDeclaredValueTzs: tier?.max_declared_value_tzs ?? 0,
      });
    }
    const [busy] = await tx`select 1 from deliveries
      where driver_id = ${driver.id} and status in ${tx([...ACTIVE_STATUSES])}`;
    if (busy && d.status === "OPEN") throw new ApiError(409, "DRIVER_BUSY", "Finish your current delivery first");

    // Assign first: the table requires a driver on every accepted delivery.
    const commission = commissionFor(await pricingRule(tx, d.vehicle_class), d.price_tzs);
    if (d.status === "OPEN") {
      await tx`update deliveries set driver_id = ${driver.id}, commission_tzs = ${commission}, accepted_at = now()
               where id = ${d.id}`;
    }
    await applyTransition(tx, d, "accept", "driver", {
      userId: user.id,
      pin: input.fix ?? null,
      deviceAt: deviceTime(input.fix),
      integrity: evidence,
    });
    await holdCommission(tx, driver.id, d.id, commission);
    await enqueueWithdrawn(tx, d, "taken");
  });

  // The driver needs a new broker token that allows publishing this delivery's location.
  const realtime = await issueMqttToken(deps, user.id, await grantFor(db, user, "driver"));
  return { delivery: await view(deps, user, id), realtime };
}

export const ArriveInput = z.object({ fix: CheckpointFix, integrity: IntegrityInput });

async function driverCheckpoint(
  deps: Deps,
  user: CurrentUser,
  id: string,
  action: "arrive_pickup" | "arrive_dropoff",
  input: z.infer<typeof ArriveInput>,
) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, action);
  const evidence = await checkpointEvidence(deps, who.driverId!, id, action, input.fix, input.integrity);
  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, action, who.actor, {
      userId: user.id,
      pin: input.fix,
      deviceAt: deviceTime(input.fix),
      integrity: evidence,
    });
  });
  return view(deps, user, id);
}

export const arrivePickup = (deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof ArriveInput>) =>
  driverCheckpoint(deps, user, id, "arrive_pickup", input);
export const arriveDropoff = (deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof ArriveInput>) =>
  driverCheckpoint(deps, user, id, "arrive_dropoff", input);

export const PickupInput = z.object({
  fix: CheckpointFix,
  integrity: IntegrityInput,
  qr: z.string().max(200),
  photoUploadId: z.uuid(),
});

export async function pickup(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof PickupInput>) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "pickup");
  const evidence = await checkpointEvidence(deps, who.driverId!, id, "pickup", input.fix, input.integrity);
  if (!timingSafeEqual(input.qr, await pickupQr(deps, id))) {
    throw new ApiError(422, "WRONG_QR", "This QR code is not for this delivery");
  }
  const code = randomCode();
  const hash = await codeHash(deps, id, code);

  const d = await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, "pickup", who.actor, {
      userId: user.id,
      pin: input.fix,
      deviceAt: deviceTime(input.fix),
      integrity: evidence,
      payload: { photoUploadId: input.photoUploadId },
    });
    await attachUpload(tx, input.photoUploadId, user.id, "pickup_photo", id);
    await tx`update deliveries set picked_up_at = now(), code_hash = ${hash}, code_sends = 1 where id = ${id}`;
    return d;
  });
  const codeSms = await sendCode(deps, d, code);
  return { delivery: await view(deps, user, id), codeSms };
}

export const DeliverInput = z.object({
  fix: CheckpointFix,
  integrity: IntegrityInput,
  code: z.string().regex(/^\d{4}$/, "must be 4 digits"),
  photoUploadId: z.uuid(),
  signatureUploadId: z.uuid().optional(),
});

export async function deliver(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof DeliverInput>) {
  const { db, config } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "deliver");
  const evidence = await checkpointEvidence(deps, who.driverId!, id, "deliver", input.fix, input.integrity);
  const candidate = await codeHash(deps, id, input.code);

  // Wrong codes must be counted even though the request fails, so the outcome is decided inside
  // a transaction that always commits, and the error is thrown afterwards.
  const outcome = await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    const check = transition("deliver", d.status, who.actor);
    if (!check.ok) return { kind: "invalid_state" as const, status: d.status };
    if (d.code_attempts >= config.maxCodeAttempts) return { kind: "locked" as const };
    if (!d.code_hash || !timingSafeEqual(candidate, d.code_hash)) {
      const [r] = await tx<{ code_attempts: number }[]>`
        update deliveries set code_attempts = code_attempts + 1 where id = ${id} returning code_attempts`;
      return { kind: "wrong_code" as const, attempts: r!.code_attempts, driverId: d.driver_id! };
    }
    await applyTransition(tx, d, "deliver", who.actor, {
      userId: user.id,
      pin: input.fix,
      deviceAt: deviceTime(input.fix),
      integrity: evidence,
      payload: { photoUploadId: input.photoUploadId, signatureUploadId: input.signatureUploadId ?? null },
    });
    await attachUpload(tx, input.photoUploadId, user.id, "dropoff_photo", id);
    if (input.signatureUploadId) await attachUpload(tx, input.signatureUploadId, user.id, "signature", id);
    await tx`update deliveries set delivered_at = now() where id = ${id}`;
    await captureCommission(tx, id);
    await finishTracking(tx, deps, d);
    return { kind: "delivered" as const };
  });

  switch (outcome.kind) {
    case "invalid_state":
      throw new ApiError(409, "INVALID_STATE", `Can't deliver a delivery that is ${outcome.status}`, { status: outcome.status });
    case "locked":
      throw new ApiError(423, "CODE_LOCKED", "Too many wrong codes. Ops must unlock this delivery.");
    case "wrong_code": {
      const left = Math.max(0, config.maxCodeAttempts - outcome.attempts);
      if (left === 0) {
        await recordFraudSignal(db, { driverId: outcome.driverId, deliveryId: id, kind: "code_attempts_exhausted" });
      }
      throw new ApiError(422, "WRONG_CODE", "That code is not correct", { attemptsLeft: left });
    }
    case "delivered":
      return view(deps, user, id);
  }
}

export const ReasonInput = z.object({ reason: z.string().trim().min(3).max(500) });
export const FailInput = ReasonInput.extend({ fix: CheckpointFix.optional(), integrity: IntegrityInput });

/** Driver (or ops) gives the job back before pickup; it goes back to OPEN for other drivers. */
export async function release(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof ReasonInput>) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "release");
  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, "release", who.actor, {
      userId: user.id,
      payload: { reason: input.reason, releasedDriverId: d.driver_id },
    });
    await releaseHold(tx, id);
    const [reopened] = await tx<{ offer_expires_at: Date }[]>`
      update deliveries set driver_id = null, commission_tzs = null, accepted_at = null,
             offer_expires_at = now() + make_interval(mins => ${deps.config.offerTtlMinutes})
       where id = ${id} returning offer_expires_at`;
    await enqueueClearLiveLocation(tx, d);
    await enqueueOffer(tx, { ...d, offer_expires_at: reopened!.offer_expires_at });
  });
  // The releasing driver no longer has access to the delivery, so only the outcome is returned.
  return { id, status: "OPEN" as const };
}

/** Shop (or ops) cancels before pickup. Any commission hold is released (cancellation fees: Q-07). */
export async function cancel(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof ReasonInput>) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "cancel");
  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, "cancel", who.actor, { userId: user.id, payload: { reason: input.reason } });
    await releaseHold(tx, id);
    if (d.status === "OPEN") await enqueueWithdrawn(tx, d, "cancelled");
    await finishTracking(tx, deps, d);
  });
  return view(deps, user, id);
}

/** Recipient unreachable or refused: goods head back to the shop. The hold stays until the return is confirmed. */
export async function fail(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof FailInput>) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "fail");
  const evidence =
    who.actor === "driver" ? await checkpointEvidence(deps, who.driverId!, id, "fail", input.fix, input.integrity) : null;
  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, "fail", who.actor, {
      userId: user.id,
      pin: input.fix ?? null,
      deviceAt: deviceTime(input.fix),
      integrity: evidence,
      payload: { reason: input.reason },
    });
  });
  return view(deps, user, id);
}

/**
 * Shop confirms the goods came back. No commission is charged on a failed delivery for now;
 * whether the driver is paid for the return trip is part of Q-07.
 */
export async function confirmReturn(deps: Deps, user: CurrentUser, id: string) {
  const { db } = deps;
  const d0 = await load(db, id);
  const who = await actingAs(db, user, d0, "confirm_return");
  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    await applyTransition(tx, d, "confirm_return", who.actor, { userId: user.id });
    await releaseHold(tx, id);
    await finishTracking(tx, deps, d);
  });
  return view(deps, user, id);
}

async function finishTracking(tx: Tx, deps: Deps, d: DeliveryRow) {
  await tx`update public_links set expires_at = now() + make_interval(hours => ${deps.config.publicLinkHoursAfterFinish})
           where delivery_id = ${d.id}`;
  if (d.driver_id) await enqueueClearLiveLocation(tx, d);
}

// ---------------------------------------------------------------------------
// Delivery code: resend and unlock
// ---------------------------------------------------------------------------

/** New code by SMS when the first didn't arrive. Limited per delivery; wrong-attempt count is kept. */
export async function resendCode(deps: Deps, user: CurrentUser, id: string) {
  const { db, config } = deps;
  const d0 = await load(db, id);
  const driver = await driverFor(db, user.id);
  const allowed = (driver && driver.id === d0.driver_id) || (await shopRole(db, user.id, d0.shop_id)) || user.isOps;
  if (!allowed) throw notFound("delivery");

  const code = randomCode();
  const hash = await codeHash(deps, id, code);
  const d = await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    if (!["PICKED_UP", "AT_DROPOFF"].includes(d.status)) {
      throw new ApiError(409, "INVALID_STATE", "The code can only be resent while the goods are on the way");
    }
    if (d.code_sends >= config.maxCodeSends && !user.isOps) {
      throw new ApiError(429, "TOO_MANY_RESENDS", "The code has been sent too many times. Contact support.");
    }
    await tx`update deliveries set code_hash = ${hash}, code_sends = code_sends + 1 where id = ${id}`;
    return d;
  });
  return { codeSms: await sendCode(deps, d, code) };
}

/** Ops unlocks a delivery whose code was locked after too many wrong attempts. */
export async function unlockCode(deps: Deps, user: CurrentUser, id: string) {
  if (!user.isOps) throw notFound("delivery");
  await load(deps.db, id);
  await deps.db`update deliveries set code_attempts = 0 where id = ${id}`;
  return resendCode(deps, user, id);
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

export const RateInput = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });

export async function rate(deps: Deps, user: CurrentUser, id: string, input: z.infer<typeof RateInput>) {
  const { db } = deps;
  const d0 = await load(db, id);
  const driver = await driverFor(db, user.id);
  const fromRole =
    driver && driver.id === d0.driver_id ? "driver" : (await shopRole(db, user.id, d0.shop_id)) ? "shop" : null;
  if (!fromRole) throw notFound("delivery");

  await db.begin(async (tx) => {
    const d = await load(tx, id, true);
    if (!["DELIVERED", "CLOSED"].includes(d.status)) {
      throw new ApiError(409, "INVALID_STATE", "Only finished deliveries can be rated");
    }
    await tx`insert into ratings (delivery_id, from_role, from_user_id, stars, comment)
             values (${id}, ${fromRole}, ${user.id}, ${input.stars}, ${input.comment ?? null})`;
    if (fromRole === "shop") {
      await tx`update drivers set rating_avg = (coalesce(rating_avg, 0) * rating_count + ${input.stars}) / (rating_count + 1),
                                  rating_count = rating_count + 1
               where id = ${d.driver_id}`;
    } else {
      await tx`update shops set rating_avg = (coalesce(rating_avg, 0) * rating_count + ${input.stars}) / (rating_count + 1),
                                rating_count = rating_count + 1
               where id = ${d.shop_id}`;
    }
    const [count] = await tx<{ n: number }[]>`select count(*)::int as n from ratings where delivery_id = ${id}`;
    if (count!.n === 2 && d.status === "DELIVERED") {
      await applyTransition(tx, d, "close", "system", { userId: null, payload: { reason: "both_rated" } });
    }
  });
  return view(deps, user, id);
}

// ---------------------------------------------------------------------------
// Scheduled jobs (Worker cron)
// ---------------------------------------------------------------------------

/** Expires open jobs nobody accepted in time, and closes delivered jobs nobody rated after a week. */
export async function runScheduled(deps: Deps): Promise<{ expired: number; closed: number }> {
  const { db } = deps;
  let expired = 0;
  let closed = 0;
  const due = await db<{ id: string }[]>`
    select id from deliveries where status = 'OPEN' and offer_expires_at <= now() order by offer_expires_at limit 500`;
  for (const { id } of due) {
    await db.begin(async (tx) => {
      const d = await load(tx, id, true);
      if (d.status !== "OPEN" || d.offer_expires_at.getTime() > Date.now()) return;
      await applyTransition(tx, d, "expire", "system", { userId: null });
      await enqueueWithdrawn(tx, d, "expired");
      await finishTracking(tx, deps, d);
      expired++;
    });
  }
  const stale = await db<{ id: string }[]>`
    select id from deliveries where status = 'DELIVERED' and delivered_at < now() - interval '7 days' limit 500`;
  for (const { id } of stale) {
    await db.begin(async (tx) => {
      const d = await load(tx, id, true);
      if (d.status !== "DELIVERED") return;
      await applyTransition(tx, d, "close", "system", { userId: null, payload: { reason: "rating_window_ended" } });
      closed++;
    });
  }
  return { expired, closed };
}
