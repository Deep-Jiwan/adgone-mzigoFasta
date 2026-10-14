import { isActive, type DeliveryStatus } from "@mzigo/contracts";
import type { Deps } from "../ports";
import { notFound } from "../lib/errors";

/**
 * What the recipient sees from the shared link. Deliberately minimal: no phone numbers, driver's
 * first name only, partial plate, and no position once the delivery is finished.
 */
export async function publicTracking(deps: Deps, token: string) {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(token)) throw notFound("tracking link");
  const [row] = await deps.db<{
    status: DeliveryStatus; shop_name: string; vehicle_class: string; driver_name: string | null; plate: string | null;
    snapshot: { lat: number; lng: number; t: string } | null; snapshot_at: Date | null; expires_at: Date | null;
    picked_up_at: Date | null; delivered_at: Date | null;
  }[]>`
    select d.status, s.name as shop_name, d.vehicle_class, dr.full_name as driver_name,
           (select v.plate from vehicles v where v.driver_id = dr.id and v.class = d.vehicle_class and v.active limit 1) as plate,
           l.snapshot, l.snapshot_at, l.expires_at, d.picked_up_at, d.delivered_at
      from public_links l
      join deliveries d on d.id = l.delivery_id
      join shops s on s.id = d.shop_id
      left join drivers dr on dr.id = d.driver_id
     where l.token = ${token}`;
  if (!row || (row.expires_at && row.expires_at.getTime() < Date.now())) throw notFound("tracking link");

  const showPosition = isActive(row.status) && row.snapshot;
  return {
    status: row.status,
    shopName: row.shop_name,
    vehicleClass: row.vehicle_class,
    driver: row.driver_name
      ? { firstName: row.driver_name.split(/\s+/)[0], plateHint: row.plate ? `${row.plate.slice(0, 3)}***` : null }
      : null,
    position: showPosition ? { lat: row.snapshot!.lat, lng: row.snapshot!.lng, at: row.snapshot!.t } : null,
    updatedAt: showPosition ? row.snapshot_at : null,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
  };
}
