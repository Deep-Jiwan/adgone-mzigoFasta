/**
 * Everything the API needs from the outside world, as small interfaces. The Worker entry wires real
 * implementations; tests wire in-memory ones. Providers that are still open questions (SMS gateway
 * Q-20, device integrity policy Q-37) sit behind these so choosing one later touches one file.
 */
import type { Config } from "./config";
import type { Db } from "./lib/db";

export interface AuthUser {
  userId: string;
  phone: string | null;
}

export interface AuthVerifier {
  /** Throws if the token is invalid. */
  verify(bearerToken: string): Promise<AuthUser>;
}

export interface ObjectStorage {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer; contentType: string } | null>;
}

export interface SmsSender {
  send(toE164: string, text: string): Promise<void>;
}

export type IntegrityVerdict = "pass" | "fail" | "unverified" | "missing";

export interface IntegrityVerifier {
  /** Checks a Play Integrity token from the driver app. */
  verify(token: string | undefined): Promise<{ verdict: IntegrityVerdict; details?: Record<string, unknown> }>;
}

export interface Deps {
  db: Db;
  auth: AuthVerifier;
  storage: ObjectStorage;
  sms: SmsSender;
  integrity: IntegrityVerifier;
  config: Config;
  /** Runs work after the response is sent (Workers: ctx.waitUntil). */
  defer?: (promise: Promise<unknown>) => void;
}

/**
 * Until Play Integrity is set up (needs a Google Cloud project and service account) we record
 * whether a token was sent but can't judge it. Policy on failures is Q-37.
 */
export const integrityNotConfigured: IntegrityVerifier = {
  async verify(token) {
    return { verdict: token ? "unverified" : "missing" };
  },
};

/** Development SMS sender: logs instead of sending. Replace once the gateway is chosen (Q-20). */
export const consoleSms: SmsSender = {
  async send(to, text) {
    console.log(`[sms] to=${to} text=${text}`);
  },
};
