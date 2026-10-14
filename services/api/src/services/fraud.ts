import type { Q } from "../lib/db";

export type FraudKind = "mock_location" | "impossible_speed" | "integrity_failed" | "code_attempts_exhausted";

/**
 * Records a fraud signal for ops. Call it on the pooled connection, not inside the transaction
 * that is about to fail, so the signal survives the rollback.
 */
export async function recordFraudSignal(
  q: Q,
  s: { driverId: string; deliveryId?: string | null; kind: FraudKind; details?: Record<string, unknown> },
) {
  await q`insert into fraud_signals (driver_id, delivery_id, kind, details)
          values (${s.driverId}, ${s.deliveryId ?? null}, ${s.kind}, ${q.json((s.details ?? {}) as never)})`;
}
