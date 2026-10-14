export interface Config {
  /** Secret for HMACs: delivery codes and pickup QR payloads. */
  codeSecret: string;
  /** Secret the MQTT broker uses to verify client tokens (EMQX JWT auth, HS256). */
  mqttJwtSecret: string;
  mqttTokenTtlSeconds: number;
  /** How long a posted job stays open before it expires. */
  offerTtlMinutes: number;
  /** How long a tracking link keeps working after the delivery finishes (Q-23). */
  publicLinkHoursAfterFinish: number;
  /** Base URL of the public tracking page; the token is appended. */
  publicTrackingBaseUrl: string;
  /** Wrong delivery-code attempts before the code locks (ops can unlock). */
  maxCodeAttempts: number;
  /** Total delivery-code SMS per delivery (first send + resends). */
  maxCodeSends: number;
  maxUploadBytes: number;
}

export const defaultConfig = {
  mqttTokenTtlSeconds: 12 * 60 * 60,
  offerTtlMinutes: 15,
  publicLinkHoursAfterFinish: 24,
  maxCodeAttempts: 5,
  maxCodeSends: 3,
  maxUploadBytes: 5 * 1024 * 1024,
} satisfies Partial<Config>;
