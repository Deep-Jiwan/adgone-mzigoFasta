import { z } from "zod";

/** Rough bounding box of Tanzania. Pins outside it are rejected as typos. */
const TZ = { latMin: -11.8, latMax: -0.9, lngMin: 29.3, lngMax: 40.5 };

export interface LatLng {
  lat: number;
  lng: number;
}

export function inTanzania(p: LatLng): boolean {
  return p.lat >= TZ.latMin && p.lat <= TZ.latMax && p.lng >= TZ.lngMin && p.lng <= TZ.lngMax;
}

const latLngShape = { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) };

/** A pin that must be inside Tanzania (catches swapped lat/lng and typos). */
export const TzPin = z.object(latLngShape).refine(inTanzania, { message: "location must be inside Tanzania" });

/** A pin plus free-text landmark ("opposite Mlimani City, blue gate"). */
export const TzPlace = z
  .object({ ...latLngShape, landmark: z.string().trim().max(300).optional() })
  .refine(inTanzania, { message: "location must be inside Tanzania" });

/** A GPS fix attached to a checkpoint. `mock` is required so the app can't silently omit it. */
export const CheckpointFix = z.object({
  ...latLngShape,
  acc: z.number().nonnegative().max(100_000),
  /** Device time, unix seconds. */
  t: z.number().int().positive(),
  mock: z.boolean(),
});
export type CheckpointFix = z.infer<typeof CheckpointFix>;

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Roads are longer than straight lines. Until a routing engine gives real road distance
 * (PLAN.md Phase 2), pricing uses straight-line distance × this factor.
 */
export const ROAD_FACTOR = 1.3;
