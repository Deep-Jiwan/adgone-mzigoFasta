import { z } from "zod";
import { point, type Q } from "../lib/db";
import { ApiError } from "../lib/errors";
import { TzPin } from "../lib/geo";
import { TzPhone } from "../lib/phone";
import type { Deps } from "../ports";
import { requireShopMember, type CurrentUser } from "./access";

export const CreateShopInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: TzPhone,
  tin: z.string().trim().max(30).optional(),
});

export async function createShop(deps: Deps, user: CurrentUser, input: z.infer<typeof CreateShopInput>) {
  const id = await deps.db.begin(async (tx) => {
    const [shop] = await tx<{ id: string }[]>`
      insert into shops (name, phone, tin) values (${input.name}, ${input.phone}, ${input.tin ?? null}) returning id`;
    await tx`insert into shop_members (shop_id, user_id, phone, role)
             values (${shop!.id}, ${user.id}, ${user.phone ?? input.phone}, 'owner')`;
    return shop!.id;
  });
  return getShop(deps, user, id);
}

export async function getShop(deps: Deps, user: CurrentUser, shopId: string) {
  const { db } = deps;
  const { role } = await requireShopMember(db, user, shopId);
  const [shop] = await db`select id, name, phone, tin, status, rating_avg, rating_count, created_at from shops where id = ${shopId}`;
  const members = await db`select id, user_id, phone, role, created_at from shop_members where shop_id = ${shopId} order by created_at`;
  return {
    id: shop!.id,
    name: shop!.name,
    phone: shop!.phone,
    tin: shop!.tin,
    status: shop!.status,
    rating: shop!.rating_avg,
    ratingCount: shop!.rating_count,
    myRole: role,
    members: members.map((m) => ({ id: m.id, phone: m.phone, role: m.role, joined: m.user_id !== null })),
    pickupLocations: await pickupLocations(db, shopId),
  };
}

export const InviteInput = z.object({ phone: TzPhone });

/** Owner adds staff by phone. They get access the first time they sign in with that number. */
export async function inviteMember(deps: Deps, user: CurrentUser, shopId: string, input: z.infer<typeof InviteInput>) {
  const { db } = deps;
  await requireShopMember(db, user, shopId, ["owner"]);
  const [existing] = await db<{ id: string }[]>`select id from users where phone = ${input.phone}`;
  await db`insert into shop_members (shop_id, user_id, phone, role)
           values (${shopId}, ${existing?.id ?? null}, ${input.phone}, 'staff')`;
  return getShop(deps, user, shopId);
}

async function pickupLocations(q: Q, shopId: string) {
  const rows = await q`
    select id, name, ST_Y(pin::geometry) as lat, ST_X(pin::geometry) as lng, landmark, storefront_photo_id, is_default
      from pickup_locations where shop_id = ${shopId} and archived_at is null order by is_default desc, created_at`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    landmark: r.landmark,
    storefrontPhotoId: r.storefront_photo_id,
    isDefault: r.is_default,
  }));
}

export const PickupLocationInput = z.object({
  name: z.string().trim().min(1).max(80),
  pin: TzPin,
  landmark: z.string().trim().max(300).optional(),
  /** Required: drivers use it to recognise the building (PLAN.md §7). */
  storefrontPhotoId: z.uuid(),
  isDefault: z.boolean().default(false),
});

export async function createPickupLocation(
  deps: Deps,
  user: CurrentUser,
  shopId: string,
  input: z.infer<typeof PickupLocationInput>,
) {
  const { db } = deps;
  await requireShopMember(db, user, shopId);
  const [photo] = await db`select 1 from uploads where id = ${input.storefrontPhotoId} and owner_user_id = ${user.id} and kind = 'storefront_photo'`;
  if (!photo) throw new ApiError(422, "UPLOAD_NOT_FOUND", "storefrontPhotoId must be a storefront_photo you uploaded");
  const [hasDefault] = await db`select 1 from pickup_locations where shop_id = ${shopId} and is_default and archived_at is null`;
  await db.begin(async (tx) => {
    if (input.isDefault && hasDefault) {
      await tx`update pickup_locations set is_default = false where shop_id = ${shopId} and is_default`;
    }
    await tx`
      insert into pickup_locations (shop_id, name, pin, landmark, storefront_photo_id, is_default)
      values (${shopId}, ${input.name}, ${point(tx, input.pin)}, ${input.landmark ?? null}, ${input.storefrontPhotoId},
              ${input.isDefault || !hasDefault})`;
  });
  return pickupLocations(db, shopId);
}
