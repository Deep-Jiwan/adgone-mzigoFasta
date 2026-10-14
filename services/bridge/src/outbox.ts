/**
 * Database → broker. Publishes rows the API wrote to `outbox` in the same transaction as the change
 * they announce (transactional outbox). At-least-once: if publishing fails part-way the whole batch
 * is retried, so consumers de-duplicate (status messages carry an eventId).
 */
import type { Db } from "./db";

export interface Publisher {
  publish(topic: string, payload: string, opts: { qos: 0 | 1; retain: boolean }): Promise<void>;
}

const BATCH = 100;

export class OutboxRelay {
  private draining = false;
  private again = false;

  constructor(private readonly db: Db, private readonly publisher: Publisher) {}

  /** Publishes everything pending. Concurrent calls coalesce into one extra pass. */
  async drain(): Promise<number> {
    if (this.draining) {
      this.again = true;
      return 0;
    }
    this.draining = true;
    let total = 0;
    try {
      do {
        this.again = false;
        let n: number;
        do {
          n = await this.batch();
          total += n;
        } while (n === BATCH);
      } while (this.again);
    } finally {
      this.draining = false;
    }
    return total;
  }

  private async batch(): Promise<number> {
    return this.db.begin(async (tx) => {
      // SKIP LOCKED lets several bridge copies drain in parallel without double-publishing.
      const rows = await tx<{ id: number; topic: string; payload: unknown; qos: 0 | 1; retain: boolean }[]>`
        select id, topic, payload, qos, retain from outbox
         where published_at is null order by id limit ${BATCH} for update skip locked`;
      for (const r of rows) {
        await this.publisher.publish(r.topic, r.payload === null ? "" : JSON.stringify(r.payload), { qos: r.qos, retain: r.retain });
      }
      if (rows.length) await tx`update outbox set published_at = now() where id in ${tx(rows.map((r) => r.id))}`;
      return rows.length;
    });
  }

  /** Wakes on NOTIFY from the outbox trigger; polls as a fallback in case a notification is missed. */
  async start(pollMs: number): Promise<() => Promise<void>> {
    const kick = () => void this.drain().catch((err) => console.error("[outbox] drain failed", err));
    const listener = await this.db.listen("outbox", kick);
    const timer = setInterval(kick, pollMs);
    kick();
    return async () => {
      clearInterval(timer);
      await listener.unlisten();
    };
  }
}
