import type { VehicleClass } from "@mzigo/contracts";
import type { Q } from "../lib/db";
import { ApiError } from "../lib/errors";
import { haversineKm, ROAD_FACTOR, type LatLng } from "../lib/geo";

export interface PricingRule {
  vehicle_class: VehicleClass;
  base_tzs: number;
  per_km_tzs: number;
  min_price_tzs: number;
  commission_pct: number;
  commission_min_tzs: number;
}

export async function pricingRule(q: Q, vehicleClass: VehicleClass): Promise<PricingRule> {
  const [rule] = await q<PricingRule[]>`select * from pricing_rules where vehicle_class = ${vehicleClass}`;
  if (!rule) throw new ApiError(503, "NO_PRICING", `No pricing configured for ${vehicleClass}`);
  return rule;
}

export function estimatedRoadKm(from: LatLng, to: LatLng): number {
  return Math.round(haversineKm(from, to) * ROAD_FACTOR * 10) / 10;
}

const ROUND_TO_TZS = 500;

/** Platform price (Q-01 default): base + per-km, at least the minimum, rounded up to 500 TZS. */
export function priceFor(rule: PricingRule, distanceKm: number): number {
  const raw = Math.max(rule.min_price_tzs, rule.base_tzs + rule.per_km_tzs * distanceKm);
  return Math.ceil(raw / ROUND_TO_TZS) * ROUND_TO_TZS;
}

/** Commission on the price (tips go fully to the driver). */
export function commissionFor(rule: PricingRule, priceTzs: number): number {
  return Math.max(rule.commission_min_tzs, Math.round((priceTzs * rule.commission_pct) / 100));
}
