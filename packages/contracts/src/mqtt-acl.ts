/**
 * What each kind of client may publish and subscribe to (ARCHITECTURE.md §4.2). The API puts
 * these rules into the short-lived JWT the broker verifies.
 *
 * Rule shape is EMQX 5's JWT `acl` claim (list form), checked against EMQX 5.8.6 by
 * services/bridge/test/emqx-acl.test.ts. Rules are matched in order; the final deny closes
 * everything not explicitly allowed.
 */
import { cellAndNeighbours, encode as encodeCell } from "./geohash";
import { topics } from "./topics";
import type { VehicleClass } from "./vehicles";

export interface AclRule {
  permission: "allow" | "deny";
  action: "publish" | "subscribe" | "all";
  topic: string;
}

export type MqttGrant =
  | {
      role: "driver";
      driverId: string;
      vehicleClasses: VehicleClass[];
      activeDeliveries: { shopId: string; deliveryId: string }[];
    }
  | { role: "shop"; shopIds: string[] }
  | { role: "ops" };

const allow = (action: AclRule["action"], topic: string): AclRule => ({ permission: "allow", action, topic });

export function aclFor(grant: MqttGrant): AclRule[] {
  const rules: AclRule[] = [];
  switch (grant.role) {
    case "driver":
      rules.push(allow("publish", topics.driverPresence(grant.driverId)));
      rules.push(allow("subscribe", topics.driverInbox(grant.driverId)));
      // Drivers subscribe to their own cell and neighbours; which cells changes as they move,
      // so the grant covers every cell of their vehicle classes.
      for (const vc of grant.vehicleClasses) rules.push(allow("subscribe", topics.jobsAllCells(vc)));
      for (const d of grant.activeDeliveries) {
        rules.push(allow("publish", topics.deliveryLocation(d.shopId, d.deliveryId)));
        rules.push(allow("publish", topics.deliveryLocationBatch(d.shopId, d.deliveryId)));
        rules.push(allow("subscribe", topics.deliveryEvents(d.shopId, d.deliveryId)));
      }
      break;
    case "shop":
      // Read-only access to everything under the shop's own deliveries.
      for (const shopId of grant.shopIds) rules.push(allow("subscribe", topics.shopAll(shopId)));
      break;
    case "ops":
      rules.push(allow("subscribe", topics.everything));
      break;
  }
  rules.push({ permission: "deny", action: "all", topic: "#" });
  return rules;
}

/** The cells a driver at (lat, lng) should be subscribed to for job offers. */
export function jobCellsAround(lat: number, lng: number, precision = 5): string[] {
  return cellAndNeighbours(encodeCell(lat, lng, precision));
}

