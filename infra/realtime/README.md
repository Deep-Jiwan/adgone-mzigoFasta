# Realtime host: EMQX + bridge

One small VPS running the MQTT broker and the bridge (docs/ARCHITECTURE.md §3, Q-26).

```sh
cp .env.example .env                                      # fill in secrets
cp emqx/auth-bootstrap.csv.example emqx/auth-bootstrap.csv # set the bridge password
docker compose up -d
```

## How clients authenticate

- **Apps** connect with MQTT username = their user id and password = the token from
  `POST /v1/realtime/token`. EMQX checks the signature (`MQTT_JWT_SECRET`, shared with the API),
  that the username matches the token, and then allows only the topics listed in the token's `acl`
  claim. Everything else is denied.
- **The bridge** is a superuser from the built-in database, seeded from `auth-bootstrap.csv`.

These rules are tested against EMQX 5.8.6 in `services/bridge/test/emqx-acl.test.ts`.

## Before production

- **TLS.** Drivers should use `mqtts://` (8883) and browsers `wss://` (8084) with a real
  certificate, or put a TLS proxy in front. The compose file exposes plain ports for setup only.
- **Dashboard** (18083) is bound to localhost; reach it through an SSH tunnel and change the
  default admin password on first login.
- **Licence.** The image is pinned to EMQX 5.8.6. Check EMQX's licence terms for the version and
  deployment size you run (Q-26).
- **Not yet verified here:** the bridge Docker image build (Docker Hub rate-limited the build
  environment). The bridge itself is tested, including against a real EMQX.
