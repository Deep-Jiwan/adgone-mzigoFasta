# MzigoFasta (working name)

On-demand B2B delivery for Dar es Salaam, built to scale across Tanzania.

Shops post a delivery. Nearby drivers with the right vehicle (boda, bajaji, car, pickup, canter)
see it and accept. The shop watches the driver live on a map, hands over the goods against a
QR code, and shares a public tracking link with its customer. The customer confirms receipt with a
one-time code, and both sides rate each other.

> Status: **backend MVP in progress.** No mobile or web apps yet.

## Documents

| Document | What it covers |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Product plan: users, journeys, scope per phase, Tanzania-specific concerns, risks |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design: control plane vs. location plane, MQTT topics, data model, key flows |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Every open business and technical decision, each with a suggested default |

## Repository

```
packages/contracts   shared: delivery state machine, MQTT topics + payloads, broker permissions, geohash
services/api         HTTP API on Cloudflare Workers (control plane)          → services/api/README.md
services/bridge      MQTT ↔ Postgres service (location plane)                 → services/bridge/README.md
infra/db             Postgres + PostGIS migrations
infra/realtime       EMQX broker + bridge, docker compose for one VPS         → infra/realtime/README.md
infra/cloudflare     edge rate-limiting rules                                 → infra/cloudflare/README.md
scripts              local test database, migration runner
```

Everything is TypeScript. `packages/contracts` is imported by the API, the bridge, and later the
apps, so topics, payloads and delivery rules are defined once.

## Working on it

Needs Node 22+, pnpm 10, and for tests PostgreSQL 16 with PostGIS 3
(`apt install postgresql-16 postgresql-16-postgis-3`).

```sh
pnpm install
pnpm db:test:start     # throwaway Postgres + PostGIS on port 54329, migrated
pnpm typecheck
pnpm test              # contracts, API and bridge, against the real database
pnpm db:test:stop
```

The broker permission tests run only against a real EMQX:

```sh
docker run -d --name mzigo-emqx -p 11883:1883 \
  -e EMQX_NODE__COOKIE=dev -e EMQX_AUTHENTICATION__2__SECRET=test-mqtt-secret \
  -v $PWD/infra/realtime/emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro \
  -v $PWD/infra/realtime/emqx/auth-bootstrap.csv.example:/opt/emqx/etc/auth-bootstrap.csv:ro \
  emqx/emqx:5.8.6
cd services/bridge && EMQX_URL=mqtt://127.0.0.1:11883 EMQX_BRIDGE_PASSWORD=CHANGE_ME_long_random_password pnpm test
```

## What exists today

**Built and tested**
- Delivery lifecycle: post → accept → arrive → pickup (QR + photo) → arrive → deliver (recipient
  code + photo) → rate → close, plus release, cancel, fail/return and automatic expiry.
- Driver wallet: commission held at accept, charged once at delivery, released on cancel; deposits
  credited once per payment reference; the database refuses negative balances, double charges and
  edits to the ledger.
- Trust and safety: fake-GPS fixes block checkpoints and raise fraud signals; impossible-speed
  detection on GPS trails; delivery code limited to 5 attempts; declared-value caps per driver tier;
  one active delivery per driver.
- Shops with staff invites, pickup locations with a required storefront photo, photo uploads to R2.
- Public tracking link: unguessable token, refreshed every 5 minutes, no phone numbers.
- MQTT: tokens with per-topic permissions (verified against a real EMQX 5.8.6), location ingest,
  transactional outbox → MQTT, job offers per map cell.
- Ops endpoints: approve/suspend drivers, record deposits, adjustments, fraud-signal review.

**Placeholders until a decision is made**
- Prices, commission rates and tier caps are seeded guesses (Q-01, Q-02, Q-08).
- SMS is logged, not sent, until a gateway is chosen (Q-20).
- Deposits are entered by ops; no payment provider yet (Q-19).
- Device integrity (Play Integrity) is recorded as "unverified"; failures are flagged, never
  blocked (Q-37).

**Not started**
- Driver app, shop web app, ops dashboard, public tracking page.
- Proof-of-delivery PDF, push notifications, number masking, ETA.
