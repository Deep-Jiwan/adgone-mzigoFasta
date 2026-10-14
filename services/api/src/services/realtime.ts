import { aclFor, ACTIVE_STATUSES, type MqttGrant } from "@mzigo/contracts";
import { SignJWT } from "jose";
import type { Q } from "../lib/db";
import { ApiError } from "../lib/errors";
import type { Deps } from "../ports";
import { driverFor, requireOps, type CurrentUser } from "./access";

export type RealtimeRole = "driver" | "shop" | "ops";

/**
 * Short-lived token for the MQTT broker. The broker checks the signature and applies the `acl`
 * rules inside it, so a client can only touch its own topics (ARCHITECTURE.md §4.2).
 * Clients must connect with MQTT username = their user id (the broker can enforce this claim).
 */
export async function issueMqttToken(deps: Deps, userId: string, grant: MqttGrant) {
  const ttl = deps.config.mqttTokenTtlSeconds;
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const token = await new SignJWT({ username: userId, role: grant.role, acl: aclFor(grant) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(new TextEncoder().encode(deps.config.mqttJwtSecret));
  return { token, username: userId, expiresAt: expiresAt.toISOString() };
}

export async function grantFor(q: Q, user: CurrentUser, role: RealtimeRole): Promise<MqttGrant> {
  switch (role) {
    case "driver": {
      const driver = await driverFor(q, user.id);
      if (!driver || driver.status !== "approved") throw new ApiError(403, "NOT_A_DRIVER", "Only approved drivers");
      const classes = await q<{ class: string }[]>`select distinct class from vehicles where driver_id = ${driver.id} and active`;
      const active = await q<{ id: string; shop_id: string }[]>`
        select id, shop_id from deliveries
         where driver_id = ${driver.id} and status in ${q([...ACTIVE_STATUSES])}`;
      return {
        role: "driver",
        driverId: driver.id,
        vehicleClasses: classes.map((c) => c.class) as never,
        activeDeliveries: active.map((d) => ({ shopId: d.shop_id, deliveryId: d.id })),
      };
    }
    case "shop": {
      const shops = await q<{ shop_id: string }[]>`select shop_id from shop_members where user_id = ${user.id}`;
      if (shops.length === 0) throw new ApiError(403, "NOT_A_SHOP_MEMBER", "You are not a member of any shop");
      return { role: "shop", shopIds: shops.map((s) => s.shop_id) };
    }
    case "ops":
      requireOps(user);
      return { role: "ops" };
  }
}
