/**
 * Broker → database. Buffers location points and writes them in batches; keeps the latest position
 * per delivery and driver presence up to date; raises fraud signals.
 */
import { isActive, LocationBatch, LocationFix, parseTopic, Presence, type DeliveryStatus, type VehicleClass } from "@mzigo/contracts";
import type { Db } from "./db";
import { checkPoint, type Finding, type Fix } from "./fraud";

interface DeliveryMeta {
  shopId: string;
  driverId: string | null;
  vehicleClass: VehicleClass;
  status: DeliveryStatus;
  loadedAt: number;
}

interface PointRow {
  delivery_id: string;
  seq: number;
  t: number;
  lat: number;
  lng: number;
  acc: number;
  spd: number | null;
  hdg: number | null;
  bat: number | null;
  mock: boolean;
}

export interface IngestStats {
  accepted: number;
  dropped: number;
}

const META_TTL_MS = 60_000;
/** One fraud signal of each kind per delivery per this window, so a spoofing phone doesn't flood ops. */
const SIGNAL_THROTTLE_MS = 10 * 60_000;
/** Points timestamped further than this from server time are rejected as clock errors. */
const MAX_FUTURE_S = 5 * 60;
const MAX_PAST_S = 7 * 24 * 3600;

export class Ingest {
  private points: PointRow[] = [];
  private signals: { driverId: string; deliveryId: string; finding: Finding }[] = [];
  private meta = new Map<string, DeliveryMeta>();
  private last = new Map<string, Fix>();
  private lastSignal = new Map<string, number>();
  readonly stats: IngestStats = { accepted: 0, dropped: 0 };

  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  /** Handles one MQTT message. Never throws: bad messages are counted and dropped. */
  async handle(topic: string, payload: Buffer): Promise<void> {
    try {
      const parsed = parseTopic(topic);
      if (!parsed) return this.drop("unknown topic", topic);
      const json = payload.length ? JSON.parse(payload.toString("utf8")) : null;

      if (parsed.kind === "driverPresence") return await this.presence(parsed.driverId, json);
      if (parsed.kind !== "deliveryLocation" && parsed.kind !== "deliveryLocationBatch") return this.drop("not ours", topic);

      const meta = await this.deliveryMeta(parsed.deliveryId);
      if (!meta || meta.shopId !== parsed.shopId) return this.drop("unknown delivery", topic);
      if (!isActive(meta.status)) return this.drop("delivery not active", topic);

      const fixes =
        parsed.kind === "deliveryLocation"
          ? [LocationFix.parse(json)]
          : LocationBatch.parse(json).points.sort((a, b) => a.t - b.t);
      for (const fix of fixes) this.point(parsed.deliveryId, meta, fix);
    } catch (err) {
      this.drop(`invalid payload: ${(err as Error).message.slice(0, 200)}`, topic);
    }
  }

  private point(deliveryId: string, meta: DeliveryMeta, fix: LocationFix) {
    const nowS = this.now() / 1000;
    if (fix.t > nowS + MAX_FUTURE_S || fix.t < nowS - MAX_PAST_S) return this.drop("timestamp out of range", deliveryId);

    const prev = this.last.get(deliveryId) ?? null;
    if (meta.driverId) {
      for (const finding of checkPoint(prev, fix, meta.vehicleClass)) {
        const key = `${deliveryId}:${finding.kind}`;
        const at = this.lastSignal.get(key) ?? 0;
        if (this.now() - at < SIGNAL_THROTTLE_MS) continue;
        this.lastSignal.set(key, this.now());
        this.signals.push({ driverId: meta.driverId, deliveryId, finding });
      }
    }
    if (!prev || fix.t >= prev.t) this.last.set(deliveryId, fix);

    this.points.push({
      delivery_id: deliveryId,
      seq: fix.seq,
      t: fix.t,
      lat: fix.lat,
      lng: fix.lng,
      acc: fix.acc,
      spd: fix.spd ?? null,
      hdg: fix.hdg ?? null,
      bat: fix.bat ?? null,
      mock: fix.mock,
    });
    this.stats.accepted++;
  }

  private async presence(driverId: string, json: unknown) {
    const p = Presence.parse(json);
    if (p.online) {
      await this.db`
        insert into driver_presence (driver_id, pin, online, t, mock, updated_at)
        values (${driverId}, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography, true, to_timestamp(${p.t}), ${p.mock}, now())
        on conflict (driver_id) do update
          set pin = excluded.pin, online = true, t = excluded.t, mock = excluded.mock, updated_at = now()
        where driver_presence.t is null or excluded.t >= driver_presence.t`
        .catch((err) => this.drop(`presence for unknown driver: ${err.message}`, driverId));
    } else {
      await this.db`update driver_presence set online = false, updated_at = now() where driver_id = ${driverId}`;
    }
    this.stats.accepted++;
  }

  private async deliveryMeta(id: string): Promise<DeliveryMeta | null> {
    const cached = this.meta.get(id);
    if (cached && this.now() - cached.loadedAt < META_TTL_MS) return cached;
    const [row] = await this.db<{ shop_id: string; driver_id: string | null; vehicle_class: VehicleClass; status: DeliveryStatus }[]>`
      select shop_id, driver_id, vehicle_class, status from deliveries where id = ${id}`;
    if (!row) {
      this.meta.delete(id);
      return null;
    }
    const meta = { shopId: row.shop_id, driverId: row.driver_id, vehicleClass: row.vehicle_class, status: row.status, loadedAt: this.now() };
    this.meta.set(id, meta);
    return meta;
  }

  /** Writes buffered points and signals. Called on a timer; safe to call when empty. */
  async flush(): Promise<number> {
    const points = this.points;
    const signals = this.signals;
    this.points = [];
    this.signals = [];
    if (points.length === 0 && signals.length === 0) return 0;

    try {
      await this.db.begin(async (tx) => {
        if (points.length) {
          const json = tx.json(points as never);
          await tx`
            insert into location_points (delivery_id, seq, t, pin, acc, spd, hdg, bat, mock)
            select x.delivery_id, x.seq, to_timestamp(x.t), ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography,
                   x.acc, x.spd, x.hdg, x.bat, x.mock
              from json_to_recordset(${json}::json) as x(
                delivery_id uuid, seq int, t double precision, lat float8, lng float8,
                acc real, spd real, hdg real, bat smallint, mock boolean)
            on conflict do nothing`;
          await tx`
            insert into delivery_latest (delivery_id, pin, t, spd, hdg, mock, updated_at)
            select distinct on (x.delivery_id)
                   x.delivery_id, ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography, to_timestamp(x.t),
                   x.spd, x.hdg, x.mock, now()
              from json_to_recordset(${json}::json) as x(
                delivery_id uuid, t double precision, lat float8, lng float8, spd real, hdg real, mock boolean)
             order by x.delivery_id, x.t desc
            on conflict (delivery_id) do update
              set pin = excluded.pin, t = excluded.t, spd = excluded.spd, hdg = excluded.hdg,
                  mock = excluded.mock, updated_at = now()
            where excluded.t > delivery_latest.t`;
        }
        for (const s of signals) {
          await tx`insert into fraud_signals (driver_id, delivery_id, kind, details)
                   values (${s.driverId}, ${s.deliveryId}, ${s.finding.kind}, ${tx.json(s.finding.details as never)})`;
        }
      });
    } catch (err) {
      // Put them back so the next flush retries; the primary key makes retries harmless.
      this.points = points.concat(this.points);
      this.signals = signals.concat(this.signals);
      throw err;
    }
    return points.length;
  }

  /** Forget deliveries that ended, so memory doesn't grow forever. */
  prune(maxAgeMs = 6 * 3600_000) {
    for (const [id, meta] of this.meta) {
      if (this.now() - meta.loadedAt > maxAgeMs) {
        this.meta.delete(id);
        this.last.delete(id);
      }
    }
  }

  private drop(reason: string, where: string) {
    this.stats.dropped++;
    if (this.stats.dropped % 100 === 1) console.warn(`[ingest] dropped (${this.stats.dropped} total): ${reason} @ ${where}`);
  }
}
