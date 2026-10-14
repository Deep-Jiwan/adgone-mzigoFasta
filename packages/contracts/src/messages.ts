/**
 * Payloads carried over MQTT (ARCHITECTURE.md §4.3). Compact JSON; validate on receipt with these
 * schemas and never trust a phone's payload without them.
 */
import { z } from "zod";
import { DELIVERY_ACTIONS, DELIVERY_STATUSES } from "./delivery";
import { VEHICLE_CLASSES } from "./vehicles";

/** One GPS fix from the driver's phone. */
export const LocationFix = z.object({
  /** Device time, unix seconds. */
  t: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Accuracy radius in metres. */
  acc: z.number().nonnegative().max(100_000),
  /** Speed in m/s. */
  spd: z.number().nonnegative().max(150).optional(),
  /** Heading in degrees. */
  hdg: z.number().min(0).max(360).optional(),
  /** Battery percent. */
  bat: z.number().int().min(0).max(100).optional(),
  /** Per-delivery counter; lets consumers drop duplicates and spot gaps. */
  seq: z.number().int().nonnegative(),
  /** Android reported the fix as coming from a mock-location (fake GPS) app. */
  mock: z.boolean().default(false),
});
export type LocationFix = z.infer<typeof LocationFix>;

/** Points buffered while offline, sent as one message on reconnect. */
export const LocationBatch = z.object({
  points: z.array(LocationFix).min(1).max(2000),
});
export type LocationBatch = z.infer<typeof LocationBatch>;

/** Driver heartbeat while online. The MQTT Last Will is `{ "online": false }`. */
export const Presence = z.discriminatedUnion("online", [
  z.object({
    online: z.literal(true),
    t: z.number().int().positive(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    acc: z.number().nonnegative().optional(),
    mock: z.boolean().default(false),
  }),
  z.object({ online: z.literal(false) }),
]);
export type Presence = z.infer<typeof Presence>;

/** Published on `.../evt` after a status change is committed. */
export const DeliveryStatusMessage = z.object({
  type: z.literal("delivery.status"),
  eventId: z.string(),
  deliveryId: z.string(),
  /** "post" for a newly posted delivery, otherwise the state-machine action. */
  action: z.enum([...DELIVERY_ACTIONS, "post"]),
  status: z.enum(DELIVERY_STATUSES),
  at: z.string(),
});
export type DeliveryStatusMessage = z.infer<typeof DeliveryStatusMessage>;

/** Published on `jobs/{class}/{cell}` when a delivery becomes OPEN. */
export const JobOfferMessage = z.object({
  type: z.literal("job.offered"),
  deliveryId: z.string(),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  pickup: z.object({ lat: z.number(), lng: z.number(), landmark: z.string().nullable() }),
  /** Approximate only (≈100 m), so the exact customer address isn't broadcast to every driver. */
  dropoffArea: z.object({ lat: z.number(), lng: z.number() }),
  distanceKm: z.number(),
  priceTzs: z.number().int(),
  declaredValueTzs: z.number().int(),
  expiresAt: z.string(),
});
export type JobOfferMessage = z.infer<typeof JobOfferMessage>;

/** Published on the same jobs topic when an offer is no longer available. */
export const JobWithdrawnMessage = z.object({
  type: z.literal("job.withdrawn"),
  deliveryId: z.string(),
  reason: z.enum(["taken", "cancelled", "expired"]),
});
export type JobWithdrawnMessage = z.infer<typeof JobWithdrawnMessage>;

export const JobMessage = z.discriminatedUnion("type", [JobOfferMessage, JobWithdrawnMessage]);
export type JobMessage = z.infer<typeof JobMessage>;
