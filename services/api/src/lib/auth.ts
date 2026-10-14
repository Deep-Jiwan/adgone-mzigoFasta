import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthUser, AuthVerifier } from "../ports";
import { normalizeTzPhone } from "./phone";

export interface JwtAuthOptions {
  /** Asymmetric keys, e.g. Supabase: https://<project>.supabase.co/auth/v1/.well-known/jwks.json */
  jwksUrl?: string;
  /** Shared secret (HS256), e.g. Supabase legacy JWT secret, or tests. */
  hs256Secret?: string;
  issuer?: string;
  audience?: string;
}

/** Verifies access tokens issued by the auth provider (Supabase Auth with phone sign-in). */
export function jwtAuth(options: JwtAuthOptions): AuthVerifier {
  let key: JWTVerifyGetKey | Uint8Array;
  if (options.jwksUrl) key = createRemoteJWKSet(new URL(options.jwksUrl));
  else if (options.hs256Secret) key = new TextEncoder().encode(options.hs256Secret);
  else throw new Error("jwtAuth needs jwksUrl or hs256Secret");

  return {
    async verify(token): Promise<AuthUser> {
      const { payload } = await jwtVerify(token, key as Uint8Array, {
        issuer: options.issuer,
        audience: options.audience,
      });
      if (!payload.sub) throw new Error("token has no subject");
      const rawPhone = typeof payload.phone === "string" && payload.phone ? payload.phone : null;
      return { userId: payload.sub, phone: rawPhone ? normalizeTzPhone(rawPhone) ?? `+${rawPhone.replace(/^\+/, "")}` : null };
    },
  };
}
