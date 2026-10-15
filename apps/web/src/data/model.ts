import { type DeliveryStatus } from "@mzigo/contracts";

/* ---------- places (Dar es Salaam) ---------- */
export interface Place { name: string; area: string; lat: number; lng: number }
export const PLACES: Place[] = [
  { name: "Kariakoo Market", area: "Kariakoo", lat: -6.8184, lng: 39.273 },
  { name: "Posta, City Centre", area: "Posta", lat: -6.816, lng: 39.288 },
  { name: "Mlimani City", area: "Ubungo", lat: -6.7725, lng: 39.2195 },
  { name: "Mwenge Handcraft Market", area: "Mwenge", lat: -6.7645, lng: 39.2335 },
  { name: "Sinza Mori", area: "Sinza", lat: -6.7785, lng: 39.2262 },
  { name: "Mikocheni B", area: "Mikocheni", lat: -6.7715, lng: 39.2465 },
  { name: "Masaki Slipway", area: "Masaki", lat: -6.7456, lng: 39.2862 },
  { name: "Oysterbay Shoppers", area: "Oysterbay", lat: -6.7705, lng: 39.2795 },
  { name: "Mbezi Beach", area: "Mbezi", lat: -6.7275, lng: 39.2105 },
  { name: "Ubungo Bus Terminal", area: "Ubungo", lat: -6.7992, lng: 39.2268 },
  { name: "Tabata Dampo", area: "Tabata", lat: -6.8208, lng: 39.2065 },
  { name: "Mbagala Rangi Tatu", area: "Mbagala", lat: -6.8935, lng: 39.2745 },
  { name: "Temeke Stereo", area: "Temeke", lat: -6.8702, lng: 39.2705 },
  { name: "Upanga Mosque Street", area: "Upanga", lat: -6.8102, lng: 39.2815 },
];

export function distanceKm(a: Place, b: Place): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  // Roads are longer than the crow flies.
  return Math.max(0.8, Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.35 * 10) / 10);
}

/* ---------- settings (everything the admin can change) ---------- */
export type VehicleKey = "boda" | "bajaji" | "pickup" | "car" | "canter";
export type PricingMode = "platform" | "shop_offer" | "bidding";
export type CommissionMode = "percent" | "fixed" | "both";

export interface VehicleSetting { label: string; enabled: boolean; base: number; perKm: number; min: number; maxKg: number; hint: string; etaMinPerKm: number }
export interface Settings {
  pricingMode: PricingMode;
  tipsEnabled: boolean;
  vehicles: Record<VehicleKey, VehicleSetting>;
  commission: { mode: CommissionMode; percent: number; fixed: number };
  payments: { cash: boolean; mobileMoney: boolean };
  operations: { area: string; hours: string };
  tracking: { refreshSeconds: number; showDriverFirstName: boolean; showPlate: boolean };
  cancellation: { freeMinutes: number };
}

export const DEFAULT_SETTINGS: Settings = {
  pricingMode: "platform",
  tipsEnabled: true,
  vehicles: {
    boda: { label: "Boda", enabled: true, base: 1500, perKm: 450, min: 2500, maxKg: 20, hint: "Documents, small parcels, up to 20 kg", etaMinPerKm: 2.2 },
    bajaji: { label: "Bajaji", enabled: true, base: 3000, perKm: 700, min: 5000, maxKg: 150, hint: "Boxes and bulky items, up to 150 kg", etaMinPerKm: 3 },
    pickup: { label: "Pickup", enabled: true, base: 8000, perKm: 1400, min: 12000, maxKg: 1000, hint: "Furniture, stock, up to 1 tonne", etaMinPerKm: 3.2 },
    car: { label: "Car", enabled: false, base: 4000, perKm: 900, min: 6000, maxKg: 200, hint: "Not offered at launch", etaMinPerKm: 2.6 },
    canter: { label: "Canter", enabled: false, base: 25000, perKm: 2500, min: 35000, maxKg: 3500, hint: "Not offered at launch", etaMinPerKm: 3.5 },
  },
  commission: { mode: "percent", percent: 12, fixed: 500 },
  payments: { cash: true, mobileMoney: false },
  operations: { area: "Dar es Salaam", hours: "24/7" },
  tracking: { refreshSeconds: 10, showDriverFirstName: true, showPlate: true },
  cancellation: { freeMinutes: 2 },
};

const round = (n: number, step: number) => Math.round(n / step) * step;

export function quote(s: Settings, vehicle: VehicleKey, km: number): number {
  const v = s.vehicles[vehicle];
  return Math.max(v.min, round(v.base + v.perKm * km, 500));
}
export function commissionFor(s: Settings, price: number): number {
  const { mode, percent, fixed } = s.commission;
  const pct = Math.round((price * percent) / 100);
  return mode === "percent" ? pct : mode === "fixed" ? fixed : pct + fixed;
}
export const etaMinutes = (s: Settings, vehicle: VehicleKey, km: number) => Math.max(4, Math.round(s.vehicles[vehicle].etaMinPerKm * km));

/* ---------- entities ---------- */
export type PaymentMethod = "cash" | "mobile";
export type Payer = "sender" | "recipient";

export interface Delivery {
  id: string;
  token: string;
  item: string;
  weightKg: number;
  valueTzs: number;
  vehicle: VehicleKey;
  pickup: Place;
  dropoff: Place;
  senderId: string;
  recipientName: string;
  recipientPhone: string;
  km: number;
  price: number;
  tip: number;
  commission: number;
  payer: Payer;
  paymentMethod: PaymentMethod;
  status: DeliveryStatus;
  createdLabel: string;
  driverId?: string;
  /** 0..1 along the current leg (driver → pickup while ACCEPTED, pickup → drop-off while PICKED_UP). */
  leg: number;
  code: string;
  timeline: { status: DeliveryStatus; at: string }[];
  cashCollected?: boolean;
}

export type DriverStatus = "pending" | "approved" | "suspended";
export interface Driver {
  id: string; name: string; phone: string; vehicle: VehicleKey; plate: string; rating: number; jobs: number;
  status: DriverStatus; wallet: number; tier: 1 | 2 | 3; online: boolean; joined: string; docs: { nida: boolean; licence: boolean; reg: boolean; selfie: boolean };
  lat: number; lng: number;
}
export interface Customer { id: string; name: string; business: string; phone: string; deliveries: number; spent: number; rating: number; status: "active" | "blocked"; verified: boolean }
export interface LedgerEntry { id: string; driverId: string; kind: "deposit" | "commission" | "adjustment" | "hold"; amount: number; ref: string; at: string }
export interface FraudSignal { id: string; driverId: string; kind: "mock_location" | "impossible_speed" | "wrong_code" | "integrity_failed"; detail: string; at: string; resolved: boolean; severity: "low" | "high" }

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  OPEN: "Finding driver", ACCEPTED: "Driver on the way", AT_PICKUP: "At pickup", PICKED_UP: "In transit", AT_DROPOFF: "At drop-off",
  DELIVERED: "Delivered", CLOSED: "Delivered", EXPIRED: "Expired", CANCELLED: "Cancelled", RETURNING: "Returning", RETURNED: "Returned",
};
export const STATUS_TONE: Record<DeliveryStatus, "neutral" | "accent" | "green" | "red" | "blue" | "amber"> = {
  OPEN: "amber", ACCEPTED: "blue", AT_PICKUP: "blue", PICKED_UP: "accent", AT_DROPOFF: "accent", DELIVERED: "green", CLOSED: "green",
  EXPIRED: "neutral", CANCELLED: "red", RETURNING: "red", RETURNED: "neutral",
};

/** The five dots of the progress stepper: requested → driver assigned → picked up → arriving → delivered. */
export function stepIndex(s: DeliveryStatus): number {
  switch (s) {
    case "OPEN": return 1;
    case "ACCEPTED": case "AT_PICKUP": return 2;
    case "PICKED_UP": return 3;
    case "AT_DROPOFF": return 4;
    case "DELIVERED": case "CLOSED": return 5;
    default: return 1;
  }
}
export const STEP_LABELS = ["Requested", "Driver assigned", "Picked up", "Arriving", "Delivered"];

/* ---------- seed ---------- */
const P = (n: string) => PLACES.find((p) => p.name === n)!;
const mk = (o: Partial<Delivery> & Pick<Delivery, "id" | "item" | "vehicle" | "pickup" | "dropoff" | "status" | "senderId">): Delivery => {
  const km = distanceKm(o.pickup, o.dropoff);
  const price = quote(DEFAULT_SETTINGS, o.vehicle, km);
  return {
    token: `tk_${o.id.toLowerCase().replace(/[^a-z0-9]/g, "")}x9f2`, weightKg: 3, valueTzs: 120000, recipientName: "Amina Said", recipientPhone: "+255 713 555 210",
    km, price, tip: 0, commission: commissionFor(DEFAULT_SETTINGS, price), payer: "sender", paymentMethod: "cash", createdLabel: "Today, 09:12",
    leg: 0.4, code: "4821", timeline: [{ status: "OPEN", at: "09:12" }], ...o,
  };
};

export const ME_CUSTOMER = "c1";
export const ME_DRIVER = "d1";

export const SEED_DRIVERS: Driver[] = [
  { id: "d1", name: "Juma Hassan", phone: "+255 754 100 201", vehicle: "boda", plate: "MC 482 DKR", rating: 4.8, jobs: 312, status: "approved", wallet: 24500, tier: 3, online: true, joined: "Mar 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.8, lng: 39.265 },
  { id: "d2", name: "Rehema Mwakyusa", phone: "+255 765 220 118", vehicle: "bajaji", plate: "MC 118 CSB", rating: 4.9, jobs: 204, status: "approved", wallet: 18200, tier: 2, online: true, joined: "Apr 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.778, lng: 39.24 },
  { id: "d3", name: "Baraka Kimaro", phone: "+255 712 903 774", vehicle: "pickup", plate: "T 774 DNB", rating: 4.6, jobs: 88, status: "approved", wallet: 5400, tier: 2, online: false, joined: "May 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.82, lng: 39.285 },
  { id: "d4", name: "Said Mrisho", phone: "+255 688 417 330", vehicle: "boda", plate: "MC 330 DJD", rating: 4.4, jobs: 41, status: "approved", wallet: 800, tier: 1, online: true, joined: "Jun 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.77, lng: 39.275 },
  { id: "d5", name: "Neema Lyimo", phone: "+255 767 019 552", vehicle: "boda", plate: "MC 552 DKA", rating: 0, jobs: 0, status: "pending", wallet: 0, tier: 1, online: false, joined: "Oct 2026", docs: { nida: true, licence: true, reg: false, selfie: true }, lat: -6.81, lng: 39.27 },
  { id: "d6", name: "Hamisi Chuwa", phone: "+255 655 880 491", vehicle: "bajaji", plate: "MC 491 CRW", rating: 3.9, jobs: 63, status: "suspended", wallet: 2100, tier: 1, online: false, joined: "May 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.85, lng: 39.27 },
  { id: "d7", name: "Fatuma Ngowi", phone: "+255 713 308 662", vehicle: "pickup", plate: "T 662 DLP", rating: 4.7, jobs: 129, status: "approved", wallet: 31000, tier: 3, online: true, joined: "Mar 2026", docs: { nida: true, licence: true, reg: true, selfie: true }, lat: -6.79, lng: 39.23 },
];

export const SEED_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Neema Mushi", business: "Mushi Electronics", phone: "+255 713 440 001", deliveries: 86, spent: 612500, rating: 4.9, status: "active", verified: true },
  { id: "c2", name: "Peter Massawe", business: "Posta Pharmacy", phone: "+255 754 330 920", deliveries: 143, spent: 801000, rating: 4.8, status: "active", verified: true },
  { id: "c3", name: "Zawadi Komba", business: "Zawadi Boutique", phone: "+255 765 118 042", deliveries: 27, spent: 154000, rating: 4.6, status: "active", verified: false },
  { id: "c4", name: "Ally Bakari", business: "Kariakoo Spares", phone: "+255 688 201 779", deliveries: 9, spent: 48000, rating: 3.8, status: "blocked", verified: false },
];

export const SEED_DELIVERIES: Delivery[] = [
  mk({ id: "MF-24817", item: "Mac Mini M4 Pro", vehicle: "boda", pickup: P("Kariakoo Market"), dropoff: P("Masaki Slipway"), status: "PICKED_UP", senderId: "c1", driverId: "d4", leg: 0.35, valueTzs: 3200000, weightKg: 2, timeline: [{ status: "OPEN", at: "09:12" }, { status: "ACCEPTED", at: "09:14" }, { status: "PICKED_UP", at: "09:26" }] }),
  mk({ id: "MF-24816", item: "Phone accessories (2 boxes)", vehicle: "bajaji", pickup: P("Mwenge Handcraft Market"), dropoff: P("Mlimani City"), status: "ACCEPTED", senderId: "c3", driverId: "d2", leg: 0.6, recipientName: "Grace Temba" }),
  mk({ id: "MF-24815", item: "Blood-pressure monitors", vehicle: "boda", pickup: P("Posta, City Centre"), dropoff: P("Upanga Mosque Street"), status: "OPEN", senderId: "c2", recipientName: "Dr. Salma Juma", payer: "recipient" }),
  mk({ id: "MF-24809", item: "Prescription medicine", vehicle: "boda", pickup: P("Upanga Mosque Street"), dropoff: P("Oysterbay Shoppers"), status: "OPEN", senderId: "c2", recipientName: "Mzee Kassim", createdLabel: "Today, 09:31", tip: 1000 }),
  mk({ id: "MF-24808", item: "Bag of school uniforms", vehicle: "boda", pickup: P("Kariakoo Market"), dropoff: P("Tabata Dampo"), status: "OPEN", senderId: "c3", recipientName: "Mama Neema", payer: "recipient", createdLabel: "Today, 09:35" }),
  mk({ id: "MF-24814", item: "Sound bar", vehicle: "boda", pickup: P("Kariakoo Market"), dropoff: P("Mikocheni B"), status: "DELIVERED", senderId: "c1", driverId: "d1", leg: 1, createdLabel: "Today, 08:05", timeline: [{ status: "OPEN", at: "08:05" }, { status: "ACCEPTED", at: "08:08" }, { status: "PICKED_UP", at: "08:20" }, { status: "DELIVERED", at: "08:49" }] }),
  mk({ id: "MF-24813", item: "Office chairs (4)", vehicle: "pickup", pickup: P("Ubungo Bus Terminal"), dropoff: P("Mbezi Beach"), status: "CLOSED", senderId: "c2", driverId: "d7", leg: 1, createdLabel: "Yesterday, 16:40", payer: "recipient" }),
  mk({ id: "MF-24812", item: "Wedding gown", vehicle: "bajaji", pickup: P("Oysterbay Shoppers"), dropoff: P("Sinza Mori"), status: "CLOSED", senderId: "c3", driverId: "d2", leg: 1, createdLabel: "Yesterday, 11:02" }),
  mk({ id: "MF-24811", item: "Spare parts", vehicle: "boda", pickup: P("Tabata Dampo"), dropoff: P("Temeke Stereo"), status: "CANCELLED", senderId: "c4", createdLabel: "Yesterday, 09:30" }),
  mk({ id: "MF-24810", item: "Laptop bag", vehicle: "boda", pickup: P("Mlimani City"), dropoff: P("Posta, City Centre"), status: "CLOSED", senderId: "c1", driverId: "d1", leg: 1, createdLabel: "12 Oct, 14:20" }),
];

export const SEED_LEDGER: LedgerEntry[] = [
  { id: "l1", driverId: "d1", kind: "deposit", amount: 30000, ref: "OPS-CASH-0912", at: "Today, 07:30" },
  { id: "l2", driverId: "d1", kind: "commission", amount: -400, ref: "MF-24814", at: "Today, 08:49" },
  { id: "l3", driverId: "d4", kind: "hold", amount: -500, ref: "MF-24817", at: "Today, 09:14" },
  { id: "l4", driverId: "d7", kind: "deposit", amount: 40000, ref: "OPS-CASH-0907", at: "Yesterday" },
  { id: "l5", driverId: "d2", kind: "commission", amount: -1200, ref: "MF-24812", at: "Yesterday, 12:10" },
  { id: "l6", driverId: "d4", kind: "adjustment", amount: 10000, ref: "Launch credit", at: "12 Oct" },
];

export const SEED_SIGNALS: FraudSignal[] = [
  { id: "f1", driverId: "d6", kind: "mock_location", detail: "Mock location enabled at pickup checkpoint (MF-24790)", at: "Yesterday, 18:20", resolved: false, severity: "high" },
  { id: "f2", driverId: "d4", kind: "impossible_speed", detail: "142 km/h between two fixes, 6 s apart (boda)", at: "Today, 08:31", resolved: false, severity: "low" },
  { id: "f3", driverId: "d6", kind: "wrong_code", detail: "4 wrong delivery codes on MF-24790", at: "Yesterday, 18:44", resolved: false, severity: "high" },
  { id: "f4", driverId: "d3", kind: "integrity_failed", detail: "Device integrity check failed (rooted phone)", at: "11 Oct", resolved: true, severity: "low" },
];

export const TERMINAL: DeliveryStatus[] = ["CLOSED", "DELIVERED", "EXPIRED", "CANCELLED", "RETURNED"];
