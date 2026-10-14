import { describe, expect, it } from "vitest";
import { checkPoint } from "../src/fraud";

const at = (t: number, lat: number, lng: number, extra: Partial<{ acc: number; mock: boolean }> = {}) => ({
  t, lat, lng, acc: 10, mock: false, ...extra,
});

describe("checkPoint", () => {
  it("flags mock fixes", () => {
    expect(checkPoint(null, at(100, -6.8, 39.27, { mock: true }), "boda").map((f) => f.kind)).toEqual(["mock_location"]);
  });

  it("flags a jump across town in seconds", () => {
    // Kariakoo to Mikocheni (~7 km) in 20 s ≈ 1,250 km/h
    const findings = checkPoint(at(100, -6.8189, 39.2738), at(120, -6.7629, 39.2468), "boda");
    expect(findings.map((f) => f.kind)).toEqual(["impossible_speed"]);
  });

  it("accepts normal riding speed", () => {
    // ~1 km in 2 minutes = 30 km/h
    expect(checkPoint(at(100, -6.8189, 39.2738), at(220, -6.8099, 39.2738), "boda")).toEqual([]);
  });

  it("ignores small GPS jitter and inaccurate fixes", () => {
    expect(checkPoint(at(100, -6.8189, 39.2738), at(101, -6.8179, 39.2738), "boda")).toEqual([]);
    expect(checkPoint(at(100, -6.8189, 39.2738), at(120, -6.7629, 39.2468, { acc: 500 }), "boda")).toEqual([]);
  });

  it("ignores out-of-order points", () => {
    expect(checkPoint(at(200, -6.8189, 39.2738), at(100, -6.7629, 39.2468), "boda")).toEqual([]);
  });
});
