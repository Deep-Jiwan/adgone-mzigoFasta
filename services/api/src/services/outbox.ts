import {
  encode,
  JOB_CELL_PRECISION,
  topics,
  type DeliveryAction,
  type DeliveryStatus,
  type DeliveryStatusMessage,
  type JobOfferMessage,
  type JobWithdrawnMessage,
  type VehicleClass,
} from "@mzigo/contracts";
import type { Q } from "../lib/db";

/** Queue an MQTT message; the bridge publishes it after this transaction commits. */
export async function enqueue(q: Q, topic: string, payload: unknown, opts: { qos?: 0 | 1; retain?: boolean } = {}) {
  await q`insert into outbox (topic, payload, qos, retain)
          values (${topic}, ${payload === null ? null : q.json(payload as never)}, ${opts.qos ?? 1}, ${opts.retain ?? false})`;
}

export async function enqueueStatus(
  q: Q,
  d: { id: string; shop_id: string },
  eventId: number,
  action: DeliveryAction | "post",
  status: DeliveryStatus,
  at: Date,
) {
  const msg: DeliveryStatusMessage = {
    type: "delivery.status",
    eventId: String(eventId),
    deliveryId: d.id,
    action,
    status,
    at: at.toISOString(),
  };
  await enqueue(q, topics.deliveryEvents(d.shop_id, d.id), msg);
}

export interface OfferSource {
  id: string;
  vehicle_class: VehicleClass;
  pickup_lat: number;
  pickup_lng: number;
  pickup_landmark: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  price_tzs: number;
  tip_tzs: number;
  declared_value_tzs: number;
  offer_expires_at: Date;
}

export function jobTopicFor(d: Pick<OfferSource, "vehicle_class" | "pickup_lat" | "pickup_lng">): string {
  return topics.jobs(d.vehicle_class, encode(d.pickup_lat, d.pickup_lng, JOB_CELL_PRECISION));
}

export function offerMessage(d: OfferSource): JobOfferMessage {
  const approx = (n: number) => Math.round(n * 1000) / 1000;
  return {
    type: "job.offered",
    deliveryId: d.id,
    vehicleClass: d.vehicle_class,
    pickup: { lat: d.pickup_lat, lng: d.pickup_lng, landmark: d.pickup_landmark },
    dropoffArea: { lat: approx(d.dropoff_lat), lng: approx(d.dropoff_lng) },
    distanceKm: d.distance_km,
    priceTzs: d.price_tzs + d.tip_tzs,
    declaredValueTzs: d.declared_value_tzs,
    expiresAt: d.offer_expires_at.toISOString(),
  };
}

export async function enqueueOffer(q: Q, d: OfferSource) {
  await enqueue(q, jobTopicFor(d), offerMessage(d));
}

export async function enqueueWithdrawn(q: Q, d: OfferSource, reason: JobWithdrawnMessage["reason"]) {
  const msg: JobWithdrawnMessage = { type: "job.withdrawn", deliveryId: d.id, reason };
  await enqueue(q, jobTopicFor(d), msg);
}

/** Clears the retained live position so nobody sees a stale driver after the job ends. */
export async function enqueueClearLiveLocation(q: Q, d: { id: string; shop_id: string }) {
  await enqueue(q, topics.deliveryLocation(d.shop_id, d.id), null, { qos: 1, retain: true });
}
