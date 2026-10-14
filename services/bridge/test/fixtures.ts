import { afterAll, beforeEach } from "vitest";
import { createDb } from "../src/db";

export const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/mzigo_test";
export const db = createDb(DATABASE_URL, 10);

const KEEP = new Set(["driver_tiers", "pricing_rules", "schema_migrations", "spatial_ref_sys"]);

beforeEach(async () => {
  const tables = await db<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename not like 'location_points_%'`;
  const names = tables.map((t) => t.tablename).filter((t) => !KEEP.has(t));
  await db.unsafe(`truncate ${names.map((n) => `"${n}"`).join(", ")} restart identity cascade`);
});

afterAll(async () => {
  await db.end();
});

/** Inserts the minimum rows for a delivery assigned to a driver. */
export async function makeDelivery(opts: { status?: string; vehicleClass?: string } = {}) {
  const ownerId = crypto.randomUUID();
  const driverUserId = crypto.randomUUID();
  const vehicleClass = opts.vehicleClass ?? "boda";
  await db`insert into users (id, phone) values (${ownerId}, ${"+2557" + ownerId.replace(/\D/g, "").slice(0, 8)}),
                                               (${driverUserId}, ${"+2556" + driverUserId.replace(/\D/g, "").slice(0, 8)})`;
  const [shop] = await db`insert into shops (name, phone) values ('Test shop', '+255700000000') returning id`;
  const [upload] = await db`insert into uploads (owner_user_id, kind, r2_key, content_type, size_bytes, sha256)
                            values (${ownerId}, 'storefront_photo', ${"k/" + ownerId}, 'image/jpeg', 1, 'x') returning id`;
  const [loc] = await db`insert into pickup_locations (shop_id, name, pin, storefront_photo_id)
                         values (${shop!.id}, 'Main', ST_SetSRID(ST_MakePoint(39.2738, -6.8189), 4326)::geography, ${upload!.id}) returning id`;
  const [driver] = await db`insert into drivers (user_id, full_name, nida_no, licence_no, status)
                            values (${driverUserId}, 'Test Driver', ${driverUserId}, 'DL', 'approved') returning id`;
  const [delivery] = await db`
    insert into deliveries (shop_id, pickup_location_id, driver_id, vehicle_class, status, pickup_pin, dropoff_pin,
                            recipient_name, recipient_phone, goods_description, declared_value_tzs, distance_km, price_tzs,
                            offer_expires_at, posted_by)
    values (${shop!.id}, ${loc!.id}, ${driver!.id}, ${vehicleClass}, ${opts.status ?? "PICKED_UP"},
            ST_SetSRID(ST_MakePoint(39.2738, -6.8189), 4326)::geography, ST_SetSRID(ST_MakePoint(39.2468, -6.7629), 4326)::geography,
            'Asha', '+255754000111', 'Phones', 1000, 9.1, 7000, now() + interval '15 minutes', ${ownerId})
    returning id`;
  const token = `tok_${crypto.randomUUID().replaceAll("-", "")}`;
  await db`insert into public_links (token, delivery_id) values (${token}, ${delivery!.id})`;
  return { shopId: shop!.id as string, driverId: driver!.id as string, deliveryId: delivery!.id as string, token };
}

export const nowS = () => Math.floor(Date.now() / 1000);

export async function waitFor<T>(fn: () => Promise<T | undefined | null | false>, timeoutMs = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 50));
  }
}
