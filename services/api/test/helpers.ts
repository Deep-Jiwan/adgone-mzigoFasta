import { SignJWT } from "jose";
import { afterAll, beforeEach } from "vitest";
import { createApp } from "../src/app";
import { defaultConfig } from "../src/config";
import { jwtAuth } from "../src/lib/auth";
import { createDb } from "../src/lib/db";
import type { Deps, IntegrityVerifier, ObjectStorage, SmsSender } from "../src/ports";

/** Start it with `pnpm db:test:start` from the repo root. */
export const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/mzigo_test";
const AUTH_SECRET = "test-auth-secret";

export const db = createDb(DATABASE_URL, { max: 10 });

export const sent: { to: string; text: string }[] = [];
const sms: SmsSender = {
  async send(to, text) {
    sent.push({ to, text });
  },
};

const files = new Map<string, { body: ArrayBuffer; contentType: string }>();
const storage: ObjectStorage = {
  async put(key, body, contentType) {
    files.set(key, { body, contentType });
  },
  async get(key) {
    return files.get(key) ?? null;
  },
};

let integrityVerdict: "pass" | "fail" | "unverified" | "missing" = "unverified";
export const setIntegrityVerdict = (v: typeof integrityVerdict) => {
  integrityVerdict = v;
};
const integrity: IntegrityVerifier = {
  async verify() {
    return { verdict: integrityVerdict };
  },
};

export const deps: Deps = {
  db,
  auth: jwtAuth({ hs256Secret: AUTH_SECRET, audience: "authenticated" }),
  storage,
  sms,
  integrity,
  config: {
    ...defaultConfig,
    codeSecret: "test-code-secret",
    mqttJwtSecret: "test-mqtt-secret",
    publicTrackingBaseUrl: "https://track.test/t",
  },
};

export const app = createApp(deps);

// Reference tables (pricing, tiers) and migration bookkeeping are kept; everything else is wiped.
const KEEP = new Set(["driver_tiers", "pricing_rules", "schema_migrations", "spatial_ref_sys"]);

beforeEach(async () => {
  const tables = await db<{ tablename: string }[]>`
    select tablename from pg_tables
     where schemaname = 'public' and tablename not like 'location_points_%'`;
  const names = tables.map((t) => t.tablename).filter((t) => !KEEP.has(t));
  await db.unsafe(`truncate ${names.map((n) => `"${n}"`).join(", ")} restart identity cascade`);
  sent.length = 0;
  files.clear();
  integrityVerdict = "unverified";
});

afterAll(async () => {
  await db.end();
});

let phoneCounter = 0;

export interface TestUser {
  id: string;
  phone: string;
  token: string;
}

export async function newUser(opts: { ops?: boolean; phone?: string } = {}): Promise<TestUser> {
  const id = crypto.randomUUID();
  const phone = opts.phone ?? `+2557${String(10_000_000 + ++phoneCounter * 7919).slice(-8)}`;
  const token = await new SignJWT({ phone: phone.slice(1), role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(AUTH_SECRET));
  if (opts.ops) await db`insert into users (id, phone, is_ops) values (${id}, ${phone}, true)`;
  return { id, phone, token };
}

export async function call(
  user: TestUser | null,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: any }> {
  const init: RequestInit = { method, headers: { ...headers } };
  if (user) (init.headers as Record<string, string>).Authorization = `Bearer ${user.token}`;
  if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
    init.body = body as BodyInit;
  } else if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await app.request(`http://api.test${path}`, init);
  const text = await res.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

export async function expectOk(p: Promise<{ status: number; json: any }>, status = 200) {
  const res = await p;
  if (res.status !== status) throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.json)}`);
  return res.json;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

export async function upload(user: TestUser, kind: string): Promise<string> {
  const res = await expectOk(call(user, "PUT", `/v1/uploads?kind=${kind}`, JPEG, { "Content-Type": "image/jpeg" }), 201);
  return res.id;
}

// Kariakoo market and Mikocheni, Dar es Salaam.
export const KARIAKOO = { lat: -6.8189, lng: 39.2738 };
export const MIKOCHENI = { lat: -6.7629, lng: 39.2468 };

export const fixAt = (p: { lat: number; lng: number }, mock = false) => ({
  ...p,
  acc: 8,
  t: Math.floor(Date.now() / 1000),
  mock,
});

/** A shop with an owner and a default pickup location in Kariakoo. */
export async function setupShop() {
  const owner = await newUser();
  const shop = await expectOk(call(owner, "POST", "/v1/shops", { name: "Duka la Juma", phone: owner.phone }), 201);
  const photoId = await upload(owner, "storefront_photo");
  const locations = await expectOk(
    call(owner, "POST", `/v1/shops/${shop.id}/pickup-locations`, {
      name: "Main shop",
      pin: KARIAKOO,
      landmark: "Opposite the market, blue door",
      storefrontPhotoId: photoId,
    }),
    201,
  );
  return { owner, shopId: shop.id as string, pickupLocationId: locations[0].id as string };
}

/** An approved driver with a vehicle and (optionally) a funded wallet. */
export async function setupDriver(ops: TestUser, opts: { vehicle?: string; deposit?: number; tier?: number } = {}) {
  const user = await newUser();
  const plate = `T ${Math.floor(100 + Math.random() * 899)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}BC`;
  const reg = await expectOk(
    call(user, "POST", "/v1/drivers", {
      fullName: "Baraka Mwita",
      nidaNo: String(19_900_101_000_000_000_000n + BigInt(Math.floor(Math.random() * 1e9))),
      licenceNo: "DL-12345",
      vehicle: { class: opts.vehicle ?? "boda", plate },
    }),
    201,
  );
  await expectOk(call(ops, "POST", `/v1/ops/drivers/${reg.id}/approve`, opts.tier ? { tier: opts.tier } : undefined));
  if (opts.deposit) {
    await expectOk(
      call(ops, "POST", `/v1/ops/drivers/${reg.id}/deposits`, { amountTzs: opts.deposit, externalRef: `MP-${crypto.randomUUID()}` }),
      201,
    );
  }
  return { user, driverId: reg.id as string };
}

export async function post(shop: Awaited<ReturnType<typeof setupShop>>, overrides: Record<string, unknown> = {}) {
  return expectOk(
    call(shop.owner, "POST", "/v1/deliveries", {
      shopId: shop.shopId,
      pickupLocationId: shop.pickupLocationId,
      vehicleClass: "boda",
      dropoff: { ...MIKOCHENI, landmark: "Near the petrol station" },
      recipient: { name: "Asha", phone: "0754 000 111" },
      goods: { description: "Two phones in boxes", declaredValueTzs: 200_000 },
      ...overrides,
    }),
    201,
  );
}

/** The 4-digit code from the last SMS sent to a number. */
export function lastCode(to: string): string {
  const msg = [...sent].reverse().find((m) => m.to === to);
  const match = msg?.text.match(/kupokea: (\d{4})/);
  if (!match) throw new Error(`no code sent to ${to}`);
  return match[1]!;
}
