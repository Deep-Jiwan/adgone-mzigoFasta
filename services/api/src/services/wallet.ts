import type { Q } from "../lib/db";
import { ApiError, notFound } from "../lib/errors";

export interface WalletView {
  balanceTzs: number;
  heldTzs: number;
  availableTzs: number;
}

export async function walletOf(q: Q, driverId: string): Promise<WalletView> {
  const [w] = await q<{ balance_tzs: number; held_tzs: number }[]>`
    select balance_tzs, held_tzs from driver_wallets where driver_id = ${driverId}`;
  if (!w) throw notFound("wallet");
  return { balanceTzs: w.balance_tzs, heldTzs: w.held_tzs, availableTzs: w.balance_tzs - w.held_tzs };
}

export async function walletDetails(q: Q, driverId: string) {
  const wallet = await walletOf(q, driverId);
  const entries = await q`
    select id, amount_tzs, type, delivery_id, external_ref, note, created_at
      from ledger_entries where driver_id = ${driverId} order by id desc limit 50`;
  const holds = await q`
    select delivery_id, amount_tzs, created_at from wallet_holds
     where driver_id = ${driverId} and status = 'held' order by created_at`;
  return {
    ...wallet,
    holds: holds.map((h) => ({ deliveryId: h.delivery_id, amountTzs: h.amount_tzs, createdAt: h.created_at })),
    entries: entries.map((e) => ({
      id: e.id,
      amountTzs: e.amount_tzs,
      type: e.type,
      deliveryId: e.delivery_id,
      externalRef: e.external_ref,
      note: e.note,
      createdAt: e.created_at,
    })),
  };
}

/**
 * Credits a mobile-money deposit. Safe to call again with the same reference (a retried payment
 * callback, or ops entering it twice): the second call credits nothing.
 */
export async function creditDeposit(
  q: Q,
  input: { driverId: string; amountTzs: number; externalRef: string; createdBy: string | null; note?: string },
): Promise<{ credited: boolean }> {
  const inserted = await q`
    insert into ledger_entries (driver_id, amount_tzs, type, external_ref, created_by, note)
    values (${input.driverId}, ${input.amountTzs}, 'deposit', ${input.externalRef}, ${input.createdBy}, ${input.note ?? null})
    on conflict (external_ref) where external_ref is not null do nothing
    returning id`;
  if (inserted.length > 0) return { credited: true };

  const [existing] = await q<{ driver_id: string; amount_tzs: number }[]>`
    select driver_id, amount_tzs from ledger_entries where external_ref = ${input.externalRef}`;
  if (existing && (existing.driver_id !== input.driverId || existing.amount_tzs !== input.amountTzs)) {
    throw new ApiError(409, "REFERENCE_USED", "This payment reference was already credited to a different driver or amount");
  }
  return { credited: false };
}

/** Manual correction by ops. Always carries who and why. */
export async function adjust(q: Q, input: { driverId: string; amountTzs: number; createdBy: string; note: string }) {
  await q`
    insert into ledger_entries (driver_id, amount_tzs, type, created_by, note)
    values (${input.driverId}, ${input.amountTzs}, 'adjustment', ${input.createdBy}, ${input.note})`;
}

/** Sets aside a job's commission. Fails with INSUFFICIENT_BALANCE (via the wallet constraint) if it can't be covered. */
export async function holdCommission(q: Q, driverId: string, deliveryId: string, amountTzs: number) {
  if (amountTzs <= 0) return;
  await q`insert into wallet_holds (driver_id, delivery_id, amount_tzs) values (${driverId}, ${deliveryId}, ${amountTzs})`;
}

/** Turns the open hold into a commission ledger entry. The database allows one commission per delivery. */
export async function captureCommission(q: Q, deliveryId: string) {
  const [hold] = await q<{ driver_id: string; amount_tzs: number }[]>`
    update wallet_holds set status = 'captured', settled_at = now()
     where delivery_id = ${deliveryId} and status = 'held'
    returning driver_id, amount_tzs`;
  if (!hold) return;
  await q`
    insert into ledger_entries (driver_id, amount_tzs, type, delivery_id)
    values (${hold.driver_id}, ${-hold.amount_tzs}, 'commission', ${deliveryId})`;
}

export async function releaseHold(q: Q, deliveryId: string) {
  await q`update wallet_holds set status = 'released', settled_at = now()
           where delivery_id = ${deliveryId} and status = 'held'`;
}
