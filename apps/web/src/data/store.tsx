import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { type DeliveryAction, type DeliveryStatus, transition } from "@mzigo/contracts";
import {
  type Customer, DEFAULT_SETTINGS, type Delivery, type Driver, type FraudSignal, type LedgerEntry, type Payer, type PaymentMethod, type Place, type Settings,
  type VehicleKey, SEED_CUSTOMERS, SEED_DELIVERIES, SEED_DRIVERS, SEED_LEDGER, SEED_SIGNALS, ME_CUSTOMER, commissionFor, distanceKm, quote,
} from "./model";

interface State {
  deliveries: Delivery[]; drivers: Driver[]; customers: Customer[]; ledger: LedgerEntry[]; signals: FraudSignal[]; settings: Settings; seq: number;
}

export interface NewDeliveryInput {
  item: string; weightKg: number; valueTzs: number; vehicle: VehicleKey; pickup: Place; dropoff: Place; recipientName: string; recipientPhone: string;
  payer: Payer; paymentMethod: PaymentMethod; tip: number; offer?: number;
}

type Act =
  | { t: "create"; input: NewDeliveryInput }
  | { t: "do"; id: string; action: DeliveryAction; driverId?: string }
  | { t: "tick" }
  | { t: "driver"; id: string; patch: Partial<Driver> }
  | { t: "customer"; id: string; patch: Partial<Customer> }
  | { t: "signal"; id: string }
  | { t: "deposit"; driverId: string; amount: number; ref: string }
  | { t: "settings"; settings: Settings };

const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function reducer(s: State, a: Act): State {
  switch (a.t) {
    case "create": {
      const i = a.input;
      const km = distanceKm(i.pickup, i.dropoff);
      const price = i.offer ?? quote(s.settings, i.vehicle, km);
      const id = `MF-${24818 + s.seq}`;
      const d: Delivery = {
        id, token: `tk_${id.toLowerCase().replace(/[^a-z0-9]/g, "")}${Math.random().toString(36).slice(2, 6)}`, item: i.item || "Parcel", weightKg: i.weightKg, valueTzs: i.valueTzs,
        vehicle: i.vehicle, pickup: i.pickup, dropoff: i.dropoff, senderId: ME_CUSTOMER, recipientName: i.recipientName || "Recipient", recipientPhone: i.recipientPhone,
        km, price, tip: i.tip, commission: commissionFor(s.settings, price), payer: i.payer, paymentMethod: i.paymentMethod, status: "OPEN",
        createdLabel: `Today, ${now()}`, leg: 0, code: String(1000 + Math.floor(Math.random() * 9000)), timeline: [{ status: "OPEN", at: now() }],
      };
      return { ...s, seq: s.seq + 1, deliveries: [d, ...s.deliveries] };
    }
    case "do": {
      return {
        ...s,
        deliveries: s.deliveries.map((d) => {
          if (d.id !== a.id) return d;
          const res = transition(a.action, d.status, a.action === "cancel" ? "shop" : a.action === "confirm_return" ? "shop" : "driver");
          if (!res.ok) return d;
          const next: DeliveryStatus = res.to;
          const driverId = a.action === "accept" ? a.driverId : a.action === "release" ? undefined : d.driverId;
          const leg = ["accept", "release", "pickup", "arrive_dropoff"].includes(a.action) ? (a.action === "arrive_dropoff" ? 1 : 0) : d.leg;
          const cashCollected = a.action === "deliver" ? true : d.cashCollected;
          return { ...d, status: next, driverId, leg, cashCollected, timeline: [...d.timeline, { status: next, at: now() }] };
        }),
        // Commission is held at accept and charged at delivery (see PLAN §6).
        ledger: ledgerFor(s, a),
        drivers: s.drivers.map((dr) => {
          const d = s.deliveries.find((x) => x.id === a.id);
          if (!d) return dr;
          if (a.action === "accept" && dr.id === a.driverId) return { ...dr, wallet: dr.wallet - d.commission };
          if (a.action === "release" && dr.id === d.driverId) return { ...dr, wallet: dr.wallet + d.commission };
          if (a.action === "deliver" && dr.id === d.driverId) return { ...dr, jobs: dr.jobs + 1 };
          return dr;
        }),
      };
    }
    case "tick":
      return {
        ...s,
        deliveries: s.deliveries.map((d) =>
          (d.status === "ACCEPTED" || d.status === "PICKED_UP") && d.leg < 1 ? { ...d, leg: Math.min(1, +(d.leg + 0.03).toFixed(3)) } : d,
        ),
      };
    case "driver": return { ...s, drivers: s.drivers.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)) };
    case "customer": return { ...s, customers: s.customers.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)) };
    case "signal": return { ...s, signals: s.signals.map((f) => (f.id === a.id ? { ...f, resolved: true } : f)) };
    case "deposit":
      return {
        ...s,
        drivers: s.drivers.map((d) => (d.id === a.driverId ? { ...d, wallet: d.wallet + a.amount } : d)),
        ledger: [{ id: `l${s.ledger.length + 1}`, driverId: a.driverId, kind: "deposit", amount: a.amount, ref: a.ref || "OPS-CASH", at: `Today, ${now()}` }, ...s.ledger],
      };
    case "settings": return { ...s, settings: a.settings };
  }
}

function ledgerFor(s: State, a: Extract<Act, { t: "do" }>): LedgerEntry[] {
  const d = s.deliveries.find((x) => x.id === a.id);
  if (!d) return s.ledger;
  const at = `Today, ${now()}`;
  const mk = (driverId: string, kind: LedgerEntry["kind"], amount: number): LedgerEntry => ({ id: `l${s.ledger.length + 1}`, driverId, kind, amount, ref: d.id, at });
  if (a.action === "accept" && a.driverId) return [mk(a.driverId, "hold", -d.commission), ...s.ledger];
  if (a.action === "release" && d.driverId) return [mk(d.driverId, "adjustment", d.commission), ...s.ledger];
  // The held fee becomes the charged fee: one ledger line changes kind, nothing is deducted twice.
  if (a.action === "deliver" && d.driverId) return s.ledger.map((l) => (l.ref === d.id && l.kind === "hold" ? { ...l, kind: "commission" as const, at } : l));
  return s.ledger;
}

interface Store extends State {
  createDelivery: (i: NewDeliveryInput) => string;
  act: (id: string, action: DeliveryAction, driverId?: string) => void;
  patchDriver: (id: string, patch: Partial<Driver>) => void;
  patchCustomer: (id: string, patch: Partial<Customer>) => void;
  resolveSignal: (id: string) => void;
  deposit: (driverId: string, amount: number, ref: string) => void;
  saveSettings: (s: Settings) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    deliveries: SEED_DELIVERIES, drivers: SEED_DRIVERS, customers: SEED_CUSTOMERS, ledger: SEED_LEDGER, signals: SEED_SIGNALS, settings: DEFAULT_SETTINGS, seq: 0,
  });

  // Simulated GPS: moving drivers creep along their route so the live maps feel alive.
  useEffect(() => {
    const t = setInterval(() => dispatch({ t: "tick" }), 1500);
    return () => clearInterval(t);
  }, []);

  const createDelivery = useCallback((input: NewDeliveryInput) => {
    dispatch({ t: "create", input });
    return `MF-${24818 + state.seq}`;
  }, [state.seq]);

  const value = useMemo<Store>(() => ({
    ...state, createDelivery,
    act: (id, action, driverId) => dispatch({ t: "do", id, action, driverId }),
    patchDriver: (id, patch) => dispatch({ t: "driver", id, patch }),
    patchCustomer: (id, patch) => dispatch({ t: "customer", id, patch }),
    resolveSignal: (id) => dispatch({ t: "signal", id }),
    deposit: (driverId, amount, ref) => dispatch({ t: "deposit", driverId, amount, ref }),
    saveSettings: (settings) => dispatch({ t: "settings", settings }),
  }), [state, createDelivery]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
}
