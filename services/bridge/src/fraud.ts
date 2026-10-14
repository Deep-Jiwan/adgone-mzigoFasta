import { MAX_PLAUSIBLE_SPEED_KMH, type VehicleClass } from "@mzigo/contracts";

export interface Fix {
  t: number; // unix seconds
  lat: number;
  lng: number;
  acc: number;
  mock: boolean;
}

export type Finding =
  | { kind: "mock_location"; details: Record<string, unknown> }
  | { kind: "impossible_speed"; details: Record<string, unknown> };

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Below this, a jump is treated as GPS noise rather than movement. */
const MIN_JUMP_KM = 0.3;
/** Fixes this inaccurate are too noisy to judge speed from. */
const MAX_USEFUL_ACCURACY_M = 100;

/**
 * Checks one point against the previous one for the same delivery (ARCHITECTURE.md §5).
 * Pure function: the caller decides what to do with findings.
 */
export function checkPoint(prev: Fix | null, curr: Fix, vehicleClass: VehicleClass): Finding[] {
  const findings: Finding[] = [];
  if (curr.mock) findings.push({ kind: "mock_location", details: { lat: curr.lat, lng: curr.lng, t: curr.t } });

  if (prev && curr.t > prev.t && prev.acc <= MAX_USEFUL_ACCURACY_M && curr.acc <= MAX_USEFUL_ACCURACY_M) {
    const km = distanceKm(prev, curr);
    const hours = (curr.t - prev.t) / 3600;
    const kmh = km / hours;
    if (km >= MIN_JUMP_KM && kmh > MAX_PLAUSIBLE_SPEED_KMH[vehicleClass]) {
      findings.push({
        kind: "impossible_speed",
        details: { kmh: Math.round(kmh), km: Math.round(km * 100) / 100, seconds: curr.t - prev.t, from: [prev.lat, prev.lng], to: [curr.lat, curr.lng] },
      });
    }
  }
  return findings;
}
