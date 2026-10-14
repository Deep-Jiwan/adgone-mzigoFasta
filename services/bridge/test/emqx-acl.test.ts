/**
 * Checks the real broker config (infra/realtime/emqx/emqx.conf) against tokens shaped exactly like
 * the API issues them. Needs a running EMQX, so it only runs when EMQX_URL is set:
 *   EMQX_URL=mqtt://127.0.0.1:1883 EMQX_JWT_SECRET=... EMQX_BRIDGE_PASSWORD=... pnpm test
 */
import { aclFor, topics, type MqttGrant } from "@mzigo/contracts";
import { SignJWT } from "jose";
import mqtt from "mqtt";
import { describe, expect, it } from "vitest";

const url = process.env.EMQX_URL;
const secret = process.env.EMQX_JWT_SECRET ?? "test-mqtt-secret";

const SHOP = "8b1f0c1e-7d7a-4d43-9a43-1f3c2c7c6a10";
const OTHER_SHOP = "0b1f0c1e-7d7a-4d43-9a43-1f3c2c7c6a11";
const DELIVERY = "d5e3a2b1-0000-4000-8000-000000000001";
const DRIVER = "3c9e1d2f-1111-4111-8111-000000000002";

async function tokenFor(userId: string, grant: MqttGrant, sign = secret) {
  return new SignJWT({ username: userId, role: grant.role, acl: aclFor(grant) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(sign));
}

async function connect(username: string, password: string) {
  return mqtt.connectAsync(url!, { username, password, protocolVersion: 5, reconnectPeriod: 0, connectTimeout: 5000 });
}

// mqtt.js rejects the promise when the broker answers "Not authorized" (reason code 0x87).
const DENIED = /Not authorized/;

describe.skipIf(!url)("EMQX permissions", () => {
  it("rejects a token signed with the wrong secret", async () => {
    const token = await tokenFor(DRIVER, { role: "shop", shopIds: [SHOP] }, "wrong-secret");
    await expect(connect(DRIVER, token)).rejects.toThrow();
  });

  it("rejects a valid token used with someone else's username", async () => {
    const token = await tokenFor(DRIVER, { role: "shop", shopIds: [SHOP] });
    await expect(connect("someone-else", token)).rejects.toThrow();
  });

  it("lets a shop subscribe to its own deliveries only", async () => {
    const userId = crypto.randomUUID();
    const client = await connect(userId, await tokenFor(userId, { role: "shop", shopIds: [SHOP] }));
    const ok = await client.subscribeAsync(topics.shopAll(SHOP), { qos: 1 });
    expect(ok[0]!.qos).toBe(1);
    await expect(client.subscribeAsync(topics.shopAll(OTHER_SHOP), { qos: 1 })).rejects.toThrow(DENIED);
    await expect(client.publishAsync(topics.deliveryLocation(SHOP, DELIVERY), "{}", { qos: 1 })).rejects.toThrow(DENIED);
    await client.endAsync();
  });

  it("lets a driver on a job publish that job's location, and nothing else", async () => {
    const userId = crypto.randomUUID();
    const grant: MqttGrant = { role: "driver", driverId: DRIVER, vehicleClasses: ["boda"], activeDeliveries: [{ shopId: SHOP, deliveryId: DELIVERY }] };
    const client = await connect(userId, await tokenFor(userId, grant));
    const fix = JSON.stringify({ t: 1, lat: -6.8, lng: 39.27, acc: 5, seq: 1 });

    await client.publishAsync(topics.deliveryLocation(SHOP, DELIVERY), fix, { qos: 1 });
    await expect(client.publishAsync(topics.deliveryLocation(OTHER_SHOP, DELIVERY), fix, { qos: 1 })).rejects.toThrow(DENIED);
    // Status events come only from the bridge, never from a phone.
    await expect(client.publishAsync(topics.deliveryEvents(SHOP, DELIVERY), "{}", { qos: 1 })).rejects.toThrow(DENIED);

    const jobs = await client.subscribeAsync(topics.jobs("boda", "kzf1b"), { qos: 1 });
    expect(jobs[0]!.qos).toBe(1);
    await expect(client.subscribeAsync(topics.jobs("canter", "kzf1b"), { qos: 1 })).rejects.toThrow(DENIED);
    await client.endAsync();
  });

  it("lets the bridge service account use shared subscriptions", async () => {
    const client = await connect("bridge", process.env.EMQX_BRIDGE_PASSWORD ?? "test-bridge-pass");
    const granted = await client.subscribeAsync("$share/bridge/mf/v1/s/+/d/+/loc", { qos: 1 });
    expect(granted[0]!.qos).toBe(1);
    await client.endAsync();
  });
});
