export const VEHICLE_CLASSES = ["boda", "bajaji", "car", "pickup", "canter"] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

/**
 * Highest speed (km/h) we consider physically plausible between two consecutive GPS points.
 * Anything faster is raised as an `impossible_speed` fraud signal by the bridge.
 * Deliberately generous: GPS jitter on a stopped phone can produce short bursts of high speed.
 */
export const MAX_PLAUSIBLE_SPEED_KMH: Record<VehicleClass, number> = {
  boda: 130,
  bajaji: 100,
  car: 160,
  pickup: 150,
  canter: 130,
};
