/**
 * The MQTT topic tree (ARCHITECTURE.md §4.1). Build and parse topics only through these
 * functions so the tree is defined once.
 *
 *   mf/v1/s/{shopId}/d/{deliveryId}/loc         driver → shop, bridge   live position (retained, QoS 0)
 *   mf/v1/s/{shopId}/d/{deliveryId}/loc/batch   driver → bridge         offline backlog (QoS 1)
 *   mf/v1/s/{shopId}/d/{deliveryId}/evt         bridge → shop, driver   status events (QoS 1)
 *   mf/v1/drv/{driverId}/presence               driver → bridge         heartbeat, Last Will = offline (retained)
 *   mf/v1/drv/{driverId}/inbox                  bridge → driver         personal messages (QoS 1)
 *   mf/v1/jobs/{vehicleClass}/{geohash5}        bridge → drivers        open job offers (QoS 1)
 */
import { VEHICLE_CLASSES, type VehicleClass } from "./vehicles";

export const TOPIC_ROOT = "mf/v1";

const SEGMENT = /^[A-Za-z0-9_-]+$/;

function seg(value: string, what: string): string {
  if (!SEGMENT.test(value)) throw new Error(`invalid ${what} for a topic segment: ${JSON.stringify(value)}`);
  return value;
}

export const topics = {
  deliveryLocation: (shopId: string, deliveryId: string) =>
    `${TOPIC_ROOT}/s/${seg(shopId, "shopId")}/d/${seg(deliveryId, "deliveryId")}/loc`,
  deliveryLocationBatch: (shopId: string, deliveryId: string) =>
    `${TOPIC_ROOT}/s/${seg(shopId, "shopId")}/d/${seg(deliveryId, "deliveryId")}/loc/batch`,
  deliveryEvents: (shopId: string, deliveryId: string) =>
    `${TOPIC_ROOT}/s/${seg(shopId, "shopId")}/d/${seg(deliveryId, "deliveryId")}/evt`,
  shopAll: (shopId: string) => `${TOPIC_ROOT}/s/${seg(shopId, "shopId")}/#`,
  driverPresence: (driverId: string) => `${TOPIC_ROOT}/drv/${seg(driverId, "driverId")}/presence`,
  driverInbox: (driverId: string) => `${TOPIC_ROOT}/drv/${seg(driverId, "driverId")}/inbox`,
  jobs: (vehicleClass: VehicleClass, cell: string) => `${TOPIC_ROOT}/jobs/${vehicleClass}/${seg(cell, "geohash")}`,
  jobsAllCells: (vehicleClass: VehicleClass) => `${TOPIC_ROOT}/jobs/${vehicleClass}/+`,
  everything: `${TOPIC_ROOT}/#`,
} as const;

/**
 * Subscriptions the bridge holds. With a share group (`$share/bridge/...`) several bridge copies
 * split the messages between them; pass null for brokers without shared subscriptions.
 */
export function bridgeSubscriptions(shareGroup: string | null = "bridge"): string[] {
  const prefix = shareGroup ? `$share/${shareGroup}/` : "";
  return [
    `${prefix}${TOPIC_ROOT}/s/+/d/+/loc`,
    `${prefix}${TOPIC_ROOT}/s/+/d/+/loc/batch`,
    `${prefix}${TOPIC_ROOT}/drv/+/presence`,
  ];
}

export type ParsedTopic =
  | { kind: "deliveryLocation"; shopId: string; deliveryId: string }
  | { kind: "deliveryLocationBatch"; shopId: string; deliveryId: string }
  | { kind: "deliveryEvents"; shopId: string; deliveryId: string }
  | { kind: "driverPresence"; driverId: string }
  | { kind: "driverInbox"; driverId: string }
  | { kind: "jobs"; vehicleClass: VehicleClass; cell: string };

export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts[0] !== "mf" || parts[1] !== "v1") return null;
  const rest = parts.slice(2);
  if (rest.some((p) => !SEGMENT.test(p))) return null;
  const [a, b, c, d, e, f] = rest;

  if (a === "s" && c === "d" && b && d) {
    if (rest.length === 5 && e === "loc") return { kind: "deliveryLocation", shopId: b, deliveryId: d };
    if (rest.length === 6 && e === "loc" && f === "batch") return { kind: "deliveryLocationBatch", shopId: b, deliveryId: d };
    if (rest.length === 5 && e === "evt") return { kind: "deliveryEvents", shopId: b, deliveryId: d };
    return null;
  }
  if (a === "drv" && b && rest.length === 3) {
    if (c === "presence") return { kind: "driverPresence", driverId: b };
    if (c === "inbox") return { kind: "driverInbox", driverId: b };
    return null;
  }
  if (a === "jobs" && b && c && rest.length === 3 && (VEHICLE_CLASSES as readonly string[]).includes(b)) {
    return { kind: "jobs", vehicleClass: b as VehicleClass, cell: c };
  }
  return null;
}
