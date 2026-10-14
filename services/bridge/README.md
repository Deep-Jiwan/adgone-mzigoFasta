# Bridge (location plane)

A small long-running Node service next to the MQTT broker (docs/ARCHITECTURE.md §5).

| File | Job |
|---|---|
| `src/ingest.ts` | Subscribes to driver locations and presence; batches points into `location_points`, keeps `delivery_latest` and `driver_presence` current; drops anything malformed, for the wrong shop, or for a finished delivery |
| `src/fraud.ts` | Mock-location and impossible-speed checks, throttled to one signal per kind per delivery per 10 min |
| `src/outbox.ts` | Publishes rows the API wrote to `outbox`, woken by `NOTIFY` with polling as a fallback. At-least-once; several copies can run (`FOR UPDATE SKIP LOCKED`) |
| `src/maintenance.ts` | Public tracking snapshots every 5 min; daily partition creation and outbox cleanup |
| `src/bridge.ts`, `src/main.ts` | Wiring, configuration, graceful shutdown |

Configuration (environment): `DATABASE_URL`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`,
`MQTT_SHARE_GROUP` (default `bridge`; empty disables shared subscriptions),
`PUBLIC_SNAPSHOT_INTERVAL_SECONDS` (300), `FLUSH_INTERVAL_MS` (1000), `OUTBOX_POLL_MS` (2000).

The database connection must support `LISTEN/NOTIFY`, so on Supabase use the direct or session
pooler connection string, not the transaction pooler.

```sh
pnpm dev     # tsx watch
pnpm build   # single-file bundle in dist/main.js
pnpm test    # needs the test database; the EMQX permission tests also need EMQX_URL
```
