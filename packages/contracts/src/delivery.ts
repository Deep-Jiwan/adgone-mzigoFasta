/**
 * The delivery state machine. Every status change in the API goes through `transition()`,
 * so the rules live in exactly one place.
 *
 *   OPEN ─accept─► ACCEPTED ─arrive_pickup─► AT_PICKUP ─pickup─► PICKED_UP ─arrive_dropoff─► AT_DROPOFF ─deliver─► DELIVERED ─close─► CLOSED
 *    │               │  ▲                       │                    │                          │
 *    │               │  └──────release──────────┘                    └────────fail──────────────┴─► RETURNING ─confirm_return─► RETURNED
 *    ├─expire─► EXPIRED
 *    └─cancel─► CANCELLED  (also from ACCEPTED / AT_PICKUP)
 */

export const DELIVERY_STATUSES = [
  "OPEN",
  "ACCEPTED",
  "AT_PICKUP",
  "PICKED_UP",
  "AT_DROPOFF",
  "DELIVERED",
  "CLOSED",
  "EXPIRED",
  "CANCELLED",
  "RETURNING",
  "RETURNED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type Actor = "shop" | "driver" | "ops" | "system";

export const DELIVERY_ACTIONS = [
  "accept",
  "arrive_pickup",
  "pickup",
  "release",
  "arrive_dropoff",
  "deliver",
  "fail",
  "confirm_return",
  "cancel",
  "expire",
  "close",
] as const;
export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];

interface Rule {
  from: readonly DeliveryStatus[];
  to: DeliveryStatus;
  actors: readonly Actor[];
}

export const TRANSITIONS: Record<DeliveryAction, Rule> = {
  accept: { from: ["OPEN"], to: "ACCEPTED", actors: ["driver"] },
  arrive_pickup: { from: ["ACCEPTED"], to: "AT_PICKUP", actors: ["driver"] },
  // The QR scan is the proof of pickup, so tapping "arrived" first is optional.
  pickup: { from: ["ACCEPTED", "AT_PICKUP"], to: "PICKED_UP", actors: ["driver"] },
  // Driver gives the job back before pickup: it is offered to other drivers again.
  release: { from: ["ACCEPTED", "AT_PICKUP"], to: "OPEN", actors: ["driver", "ops"] },
  arrive_dropoff: { from: ["PICKED_UP"], to: "AT_DROPOFF", actors: ["driver"] },
  deliver: { from: ["PICKED_UP", "AT_DROPOFF"], to: "DELIVERED", actors: ["driver"] },
  // Recipient unreachable or refuses: goods go back to the shop.
  fail: { from: ["PICKED_UP", "AT_DROPOFF"], to: "RETURNING", actors: ["driver", "ops"] },
  confirm_return: { from: ["RETURNING"], to: "RETURNED", actors: ["shop", "ops"] },
  // Once goods are picked up a delivery can't be cancelled, only failed and returned.
  cancel: { from: ["OPEN", "ACCEPTED", "AT_PICKUP"], to: "CANCELLED", actors: ["shop", "ops"] },
  expire: { from: ["OPEN"], to: "EXPIRED", actors: ["system"] },
  close: { from: ["DELIVERED"], to: "CLOSED", actors: ["system"] },
};

/** A driver is busy with a delivery in any of these. */
export const ACTIVE_STATUSES: readonly DeliveryStatus[] = [
  "ACCEPTED",
  "AT_PICKUP",
  "PICKED_UP",
  "AT_DROPOFF",
  "RETURNING",
];

export const TERMINAL_STATUSES: readonly DeliveryStatus[] = ["CLOSED", "EXPIRED", "CANCELLED", "RETURNED"];

export type TransitionResult =
  | { ok: true; to: DeliveryStatus }
  | { ok: false; reason: "wrong_status" | "wrong_actor" };

export function transition(action: DeliveryAction, from: DeliveryStatus, actor: Actor): TransitionResult {
  const rule = TRANSITIONS[action];
  if (!rule.actors.includes(actor)) return { ok: false, reason: "wrong_actor" };
  if (!rule.from.includes(from)) return { ok: false, reason: "wrong_status" };
  return { ok: true, to: rule.to };
}

export function isActive(status: DeliveryStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
