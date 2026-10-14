# API (control plane)

Hono app on Cloudflare Workers. Postgres through Hyperdrive, files in R2, auth tokens from the auth
provider (Supabase Auth with phone sign-in is the default, Q-28). Business logic lives in
`src/services/*` as plain TypeScript, so tests run it in Node against a real Postgres.

```
src/index.ts        Worker entry: wires Hyperdrive, R2, secrets; cron for expiry
src/app.ts          routes
src/ports.ts        interfaces for outside providers (auth, storage, SMS, device integrity)
src/services/       deliveries, wallet, shops, drivers, uploads, tracking, realtime tokens, outbox
src/lib/            db, crypto, geo, phone numbers, validation, errors
```

## Endpoints

All `/v1` routes need `Authorization: Bearer <access token>`. Errors are
`{ "error": { "code": "STABLE_CODE", "message": "...", "details": {...} } }`.

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/health` | anyone | liveness |
| GET | `/t/:token` | anyone | public tracking data (cached 60 s; rate-limit at the edge) |
| GET | `/v1/me` | user | profile, shops, driver profile + wallet |
| PUT | `/v1/uploads?kind=` | user | raw image body → upload id |
| GET | `/v1/uploads/:id` | involved users | the file |
| POST | `/v1/shops` | user | create a shop (caller is owner) |
| GET | `/v1/shops/:id` | member | shop, members, pickup locations |
| POST | `/v1/shops/:id/members` | owner | invite staff by phone |
| POST | `/v1/shops/:id/pickup-locations` | member | add a pickup location (storefront photo required) |
| POST | `/v1/drivers` | user | register as a driver (pending until approved) |
| GET | `/v1/drivers/me/wallet` | driver | balance, held, available, recent entries |
| GET | `/v1/offers?lat&lng&radiusKm` | approved driver | open jobs nearby, with `canAccept` / `blockedBy` |
| POST | `/v1/quotes` | user | price for a route and vehicle class |
| POST | `/v1/deliveries` | member | post a delivery |
| GET | `/v1/deliveries?shopId=` or `?as=driver` | member / driver | list |
| GET | `/v1/deliveries/:id` | involved users | detail (shop side also gets `pickupQr`, `trackingUrl`) |
| POST | `/v1/deliveries/:id/accept` | approved driver | take the job; returns a new MQTT token |
| POST | `.../arrive-pickup`, `.../arrive-dropoff` | assigned driver | checkpoint with GPS fix |
| POST | `.../pickup` | assigned driver | QR + photo; recipient gets the code by SMS |
| POST | `.../deliver` | assigned driver | recipient's code + photo; charges commission |
| POST | `.../release` | driver, ops | give the job back before pickup |
| POST | `.../cancel` | shop, ops | cancel before pickup |
| POST | `.../fail` → `.../confirm-return` | driver/ops → shop/ops | failed delivery, goods returned |
| POST | `.../resend-code` | shop, driver, ops | new code by SMS (limited) |
| POST | `.../rating` | shop, driver | 1–5 stars; both ratings close the delivery |
| POST | `/v1/realtime/token` | user | MQTT token for `as: driver | shop | ops` |
| GET/POST | `/v1/ops/...` | ops | drivers (list/approve/suspend), wallets, deposits, adjustments, fraud signals, unlock code, wallet drift |

Every checkpoint takes `fix: { lat, lng, acc, t, mock }` (`mock` is required) and optional
`integrity: { token, appVersion }`. A mock fix is refused with `MOCK_LOCATION` and recorded as a
fraud signal.

## Configuration

`wrangler.toml` holds bindings and non-secret vars. Secrets, set with `wrangler secret put`:

| Secret | Purpose |
|---|---|
| `CODE_SECRET` | HMAC key for delivery codes and pickup QR codes |
| `MQTT_JWT_SECRET` | signs broker tokens; same value as EMQX's JWT secret |
| `AUTH_JWT_SECRET` | only if the auth provider signs with HS256; otherwise set `AUTH_JWKS_URL` |

## Deploying (first time)

1. Create the Postgres database (Supabase project, Q-28) and run the migrations:
   `DATABASE_URL=... pnpm db:migrate` from the repo root.
2. `wrangler hyperdrive create mzigofasta --connection-string=...` and put the id in `wrangler.toml`.
3. `wrangler r2 bucket create mzigofasta-files`.
4. Set the secrets above, plus `AUTH_JWKS_URL` / `AUTH_ISSUER` for Supabase.
5. `pnpm deploy`.
6. Add the rate-limiting rules in [infra/cloudflare](../../infra/cloudflare/README.md).

Local: `cp .dev.vars.example .dev.vars && pnpm dev` (uses the test database from
`pnpm db:test:start`).
