import { ApiError, forbidden } from "../lib/errors";
import type { Q } from "../lib/db";
import type { AuthUser } from "../ports";
import type { VehicleClass } from "@mzigo/contracts";

export interface CurrentUser {
  id: string;
  phone: string | null;
  isOps: boolean;
}

/** Makes sure the authenticated person has a users row. New users also claim pending shop invites. */
export async function ensureUser(q: Q, auth: AuthUser): Promise<CurrentUser> {
  const [existing] = await q<{ id: string; phone: string | null; is_ops: boolean }[]>`
    select id, phone, is_ops from users where id = ${auth.userId}`;
  if (existing) return { id: existing.id, phone: existing.phone, isOps: existing.is_ops };

  const [created] = await q<{ id: string; phone: string | null; is_ops: boolean }[]>`
    insert into users (id, phone) values (${auth.userId}, ${auth.phone})
    on conflict (id) do update set phone = coalesce(users.phone, excluded.phone)
    returning id, phone, is_ops`;
  await claimInvites(q, created!.id, created!.phone);
  return { id: created!.id, phone: created!.phone, isOps: created!.is_ops };
}

export async function claimInvites(q: Q, userId: string, phone: string | null): Promise<void> {
  if (!phone) return;
  await q`update shop_members set user_id = ${userId} where phone = ${phone} and user_id is null`;
}

export async function shopRole(q: Q, userId: string, shopId: string): Promise<"owner" | "staff" | null> {
  const [row] = await q<{ role: "owner" | "staff" }[]>`
    select role from shop_members where shop_id = ${shopId} and user_id = ${userId}`;
  return row?.role ?? null;
}

export async function requireShopMember(q: Q, user: CurrentUser, shopId: string, roles: ("owner" | "staff")[] = ["owner", "staff"]) {
  const role = await shopRole(q, user.id, shopId);
  if (!role) throw new ApiError(404, "NOT_FOUND", "shop not found");
  if (!roles.includes(role)) throw forbidden("Only the shop owner can do this");
  const [shop] = await q<{ id: string; name: string; status: string }[]>`select id, name, status from shops where id = ${shopId}`;
  if (shop?.status !== "active") throw forbidden("Shop is suspended");
  return { role, shop };
}

export interface DriverRow {
  id: string;
  user_id: string;
  full_name: string;
  status: "pending" | "approved" | "suspended";
  tier: number;
}

export async function driverFor(q: Q, userId: string): Promise<DriverRow | null> {
  const [row] = await q<DriverRow[]>`select id, user_id, full_name, status, tier from drivers where user_id = ${userId}`;
  return row ?? null;
}

export async function requireApprovedDriver(q: Q, user: CurrentUser): Promise<DriverRow & { vehicleClasses: VehicleClass[] }> {
  const driver = await driverFor(q, user.id);
  if (!driver) throw new ApiError(403, "NOT_A_DRIVER", "Register as a driver first");
  if (driver.status !== "approved") {
    throw new ApiError(403, driver.status === "pending" ? "DRIVER_PENDING" : "DRIVER_SUSPENDED",
      driver.status === "pending" ? "Your registration is waiting for approval" : "Your account is suspended");
  }
  const rows = await q<{ class: VehicleClass }[]>`select distinct class from vehicles where driver_id = ${driver.id} and active`;
  return { ...driver, vehicleClasses: rows.map((r) => r.class) };
}

export function requireOps(user: CurrentUser): void {
  if (!user.isOps) throw new ApiError(404, "NOT_FOUND", "not found");
}
