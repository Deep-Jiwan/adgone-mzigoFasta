import { z } from "zod";
import { sha256Hex } from "../lib/crypto";
import { ApiError, notFound } from "../lib/errors";
import type { Deps } from "../ports";
import { driverFor, shopRole, type CurrentUser } from "./access";

export const UPLOAD_KINDS = [
  "storefront_photo",
  "pickup_photo",
  "dropoff_photo",
  "signature",
  "driver_document",
  "vehicle_photo",
] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const UploadKindInput = z.object({ kind: z.enum(UPLOAD_KINDS) });

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Stores a photo or document in R2 and returns its id, which checkpoints then reference. */
export async function putUpload(deps: Deps, user: CurrentUser, kind: UploadKind, contentType: string, body: ArrayBuffer) {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  const ext = EXT[type];
  if (!ext || (type === "application/pdf" && kind !== "driver_document")) {
    throw new ApiError(415, "UNSUPPORTED_TYPE", "Upload a JPEG, PNG or WebP image (PDF only for driver documents)");
  }
  if (body.byteLength === 0) throw new ApiError(400, "EMPTY_UPLOAD", "The upload is empty");
  if (body.byteLength > deps.config.maxUploadBytes) {
    throw new ApiError(413, "TOO_LARGE", `Uploads are limited to ${Math.round(deps.config.maxUploadBytes / 1024 / 1024)} MB`);
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const key = `${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${ext}`;
  const sha256 = await sha256Hex(body);
  await deps.storage.put(key, body, type);
  await deps.db`
    insert into uploads (id, owner_user_id, kind, r2_key, content_type, size_bytes, sha256)
    values (${id}, ${user.id}, ${kind}, ${key}, ${type}, ${body.byteLength}, ${sha256})`;
  return { id, kind, sha256 };
}

/** Who may see a file: the uploader, ops, and the people involved in what it documents. */
export async function getUpload(deps: Deps, user: CurrentUser, id: string) {
  const { db } = deps;
  const [u] = await db<{ owner_user_id: string; kind: UploadKind; r2_key: string; delivery_id: string | null }[]>`
    select owner_user_id, kind, r2_key, delivery_id from uploads where id = ${id}`;
  if (!u) throw notFound("upload");

  let allowed = u.owner_user_id === user.id || user.isOps;
  if (!allowed && u.kind === "storefront_photo") {
    const driver = await driverFor(db, user.id);
    const [member] = await db`
      select 1 from pickup_locations pl join shop_members m on m.shop_id = pl.shop_id
       where pl.storefront_photo_id = ${id} and m.user_id = ${user.id}`;
    allowed = driver?.status === "approved" || !!member;
  }
  if (!allowed && u.delivery_id) {
    const [d] = await db<{ shop_id: string; driver_id: string | null }[]>`select shop_id, driver_id from deliveries where id = ${u.delivery_id}`;
    const driver = await driverFor(db, user.id);
    allowed = !!d && ((!!driver && driver.id === d.driver_id) || !!(await shopRole(db, user.id, d.shop_id)));
  }
  if (!allowed) throw notFound("upload");

  const object = await deps.storage.get(u.r2_key);
  if (!object) throw notFound("upload");
  return object;
}
