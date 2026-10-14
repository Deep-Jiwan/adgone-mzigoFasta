const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Random URL-safe token. 16 bytes = 128 bits, enough that guessing is not feasible. */
export function randomToken(bytes = 16): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Uniform random 4-digit code, "0000"–"9999". */
export function randomCode(): string {
  const buf = new Uint32Array(1);
  // Rejection sampling so every code is equally likely.
  const limit = Math.floor(0x1_0000_0000 / 10_000) * 10_000;
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return String(buf[0]! % 10_000).padStart(4, "0");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(message)));
}

export async function hmacBase64Url(secret: string, message: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(message))));
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
