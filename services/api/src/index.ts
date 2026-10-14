/// <reference types="@cloudflare/workers-types" />
import { createApp } from "./app";
import { defaultConfig, type Config } from "./config";
import { jwtAuth } from "./lib/auth";
import { createDb } from "./lib/db";
import { consoleSms, integrityNotConfigured, type Deps, type ObjectStorage } from "./ports";
import { runScheduled } from "./services/deliveries";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  FILES: R2Bucket;
  AUTH_JWKS_URL?: string;
  AUTH_JWT_SECRET?: string;
  AUTH_ISSUER?: string;
  AUTH_AUDIENCE?: string;
  CODE_SECRET: string;
  MQTT_JWT_SECRET: string;
  PUBLIC_TRACKING_BASE_URL: string;
  OFFER_TTL_MINUTES?: string;
}

function r2Storage(bucket: R2Bucket): ObjectStorage {
  return {
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { body: obj.body as unknown as ReadableStream, contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
    },
  };
}

function depsFor(env: Env, ctx: ExecutionContext): Deps {
  if (!env.CODE_SECRET || !env.MQTT_JWT_SECRET) throw new Error("CODE_SECRET and MQTT_JWT_SECRET must be set");
  const config: Config = {
    ...defaultConfig,
    codeSecret: env.CODE_SECRET,
    mqttJwtSecret: env.MQTT_JWT_SECRET,
    publicTrackingBaseUrl: env.PUBLIC_TRACKING_BASE_URL,
    offerTtlMinutes: Number(env.OFFER_TTL_MINUTES ?? defaultConfig.offerTtlMinutes),
  };
  return {
    db: createDb(env.HYPERDRIVE.connectionString),
    auth: jwtAuth({
      jwksUrl: env.AUTH_JWKS_URL,
      hs256Secret: env.AUTH_JWT_SECRET,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
    }),
    storage: r2Storage(env.FILES),
    // SMS gateway is Q-20; until then codes are logged (visible with `wrangler tail`).
    sms: consoleSms,
    integrity: integrityNotConfigured,
    config,
    defer: (p) => ctx.waitUntil(p),
  };
}

export default {
  async fetch(request, env, ctx) {
    const deps = depsFor(env, ctx);
    try {
      return await createApp(deps).fetch(request, env, ctx);
    } finally {
      ctx.waitUntil(deps.db.end());
    }
  },

  async scheduled(_controller, env, ctx) {
    const deps = depsFor(env, ctx);
    try {
      const result = await runScheduled(deps);
      if (result.expired || result.closed) console.log("scheduled", result);
    } finally {
      ctx.waitUntil(deps.db.end());
    }
  },
} satisfies ExportedHandler<Env>;
