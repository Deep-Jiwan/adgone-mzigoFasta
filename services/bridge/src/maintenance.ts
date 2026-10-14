import { ACTIVE_STATUSES } from "@mzigo/contracts";
import type { Db } from "./db";

/**
 * Refreshes what public tracking links show, at most every `intervalSeconds` per delivery
 * (5 minutes by default, Q-23). The public endpoint only ever reads this snapshot.
 */
export async function refreshPublicSnapshots(db: Db, intervalSeconds: number): Promise<number> {
  const rows = await db`
    update public_links l
       set snapshot = jsonb_build_object('lat', ST_Y(dl.pin::geometry), 'lng', ST_X(dl.pin::geometry), 't', dl.t),
           snapshot_at = now()
      from delivery_latest dl
      join deliveries d on d.id = dl.delivery_id
     where l.delivery_id = dl.delivery_id
       and d.status in ${db([...ACTIVE_STATUSES])}
       and (l.snapshot_at is null or l.snapshot_at <= now() - make_interval(secs => ${intervalSeconds}))
       and (l.snapshot is null or (l.snapshot->>'t')::timestamptz < dl.t)
    returning l.token`;
  return rows.length;
}

/** Daily housekeeping: next month's location partition, old published outbox rows. */
export async function dailyMaintenance(db: Db): Promise<void> {
  await db`select ensure_location_partitions(1)`;
  await db`delete from outbox where published_at < now() - interval '7 days'`;
}
