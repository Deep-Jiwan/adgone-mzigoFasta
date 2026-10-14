import { VEHICLE_CLASSES } from "@mzigo/contracts";
import { z } from "zod";
import { ApiError, notFound } from "../lib/errors";
import type { Deps } from "../ports";
import { driverFor, requireOps, type CurrentUser } from "./access";
import { walletOf } from "./wallet";

export const RegisterDriverInput = z.object({
  fullName: z.string().trim().min(3).max(120),
  nidaNo: z.string().trim().regex(/^[0-9-]{10,30}$/, "NIDA number should be digits"),
  licenceNo: z.string().trim().min(4).max(30),
  vehicle: z.object({
    class: z.enum(VEHICLE_CLASSES),
    plate: z.string().trim().min(3).max(15).transform((p) => p.toUpperCase().replace(/\s+/g, " ")),
    capacityKg: z.number().int().positive().max(40_000).optional(),
  }),
});

/** Sign-up. The driver stays `pending` until ops approves (PLAN.md §8). */
export async function registerDriver(deps: Deps, user: CurrentUser, input: z.infer<typeof RegisterDriverInput>) {
  await deps.db.begin(async (tx) => {
    const [driver] = await tx<{ id: string }[]>`
      insert into drivers (user_id, full_name, nida_no, licence_no)
      values (${user.id}, ${input.fullName}, ${input.nidaNo.replaceAll("-", "")}, ${input.licenceNo})
      returning id`;
    await tx`insert into vehicles (driver_id, class, plate, capacity_kg)
             values (${driver!.id}, ${input.vehicle.class}, ${input.vehicle.plate}, ${input.vehicle.capacityKg ?? null})`;
  });
  return myDriverProfile(deps, user);
}

export async function myDriverProfile(deps: Deps, user: CurrentUser) {
  const driver = await driverFor(deps.db, user.id);
  if (!driver) return null;
  return driverProfile(deps, driver.id);
}

async function driverProfile(deps: Deps, driverId: string) {
  const { db } = deps;
  const [d] = await db`select id, full_name, status, tier, rating_avg, rating_count, approved_at, created_at from drivers where id = ${driverId}`;
  if (!d) throw notFound("driver");
  const vehicles = await db`select id, class, plate, capacity_kg, active from vehicles where driver_id = ${driverId} order by created_at`;
  return {
    id: d.id,
    fullName: d.full_name,
    status: d.status,
    tier: d.tier,
    rating: d.rating_avg,
    ratingCount: d.rating_count,
    approvedAt: d.approved_at,
    vehicles: vehicles.map((v) => ({ id: v.id, class: v.class, plate: v.plate, capacityKg: v.capacity_kg, active: v.active })),
    wallet: await walletOf(db, driverId),
  };
}

// --- ops -------------------------------------------------------------------

export const ListDriversInput = z.object({ status: z.enum(["pending", "approved", "suspended"]).default("pending") });

export async function listDrivers(deps: Deps, user: CurrentUser, input: z.infer<typeof ListDriversInput>) {
  requireOps(user);
  const rows = await deps.db`
    select d.id, d.full_name, d.nida_no, d.licence_no, d.status, d.tier, d.created_at, u.phone
      from drivers d join users u on u.id = d.user_id
     where d.status = ${input.status} order by d.created_at limit 200`;
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    nidaNo: r.nida_no,
    licenceNo: r.licence_no,
    status: r.status,
    tier: r.tier,
    createdAt: r.created_at,
  }));
}

export const ApproveInput = z.object({ tier: z.number().int().min(1).optional() }).default({});

export async function approveDriver(deps: Deps, user: CurrentUser, driverId: string, input: z.infer<typeof ApproveInput>) {
  requireOps(user);
  const [row] = await deps.db`
    update drivers set status = 'approved', approved_at = now(), approved_by = ${user.id},
                       tier = coalesce(${input.tier ?? null}::smallint, tier)
     where id = ${driverId} returning id`;
  if (!row) throw notFound("driver");
  return driverProfile(deps, driverId);
}

export const SuspendInput = z.object({ reason: z.string().trim().min(3).max(500) });

export async function suspendDriver(deps: Deps, user: CurrentUser, driverId: string, input: z.infer<typeof SuspendInput>) {
  requireOps(user);
  const [row] = await deps.db`update drivers set status = 'suspended' where id = ${driverId} returning id`;
  if (!row) throw notFound("driver");
  console.log(`driver ${driverId} suspended by ${user.id}: ${input.reason}`);
  return driverProfile(deps, driverId);
}

export async function requireDriverId(deps: Deps, user: CurrentUser): Promise<string> {
  const driver = await driverFor(deps.db, user.id);
  if (!driver) throw new ApiError(403, "NOT_A_DRIVER", "Register as a driver first");
  return driver.id;
}
