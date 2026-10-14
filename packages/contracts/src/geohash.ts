/**
 * Minimal geohash. Job offers are published per geohash cell (precision 5, about 4.9 × 4.9 km),
 * and drivers subscribe to their own cell plus the 8 around it.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export const JOB_CELL_PRECISION = 5;

export function encode(lat: number, lng: number, precision: number): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "";
  let bits = 0, bitCount = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { bits = (bits << 1) | 1; lngMin = mid; } else { bits <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; latMin = mid; } else { bits <<= 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  return hash;
}

export interface Bounds { latMin: number; latMax: number; lngMin: number; lngMax: number }

export function bounds(hash: string): Bounds {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let evenBit = true;
  for (const ch of hash) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error(`invalid geohash character: ${ch}`);
    for (let n = 4; n >= 0; n--) {
      const bit = (idx >> n) & 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (bit) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bit) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

/** The cell itself plus its 8 neighbours (fewer near the poles; irrelevant for Tanzania). */
export function cellAndNeighbours(hash: string): string[] {
  const b = bounds(hash);
  const dLat = b.latMax - b.latMin;
  const dLng = b.lngMax - b.lngMin;
  const lat = (b.latMin + b.latMax) / 2;
  const lng = (b.lngMin + b.lngMax) / 2;
  const cells = new Set<string>();
  for (const i of [-1, 0, 1]) {
    for (const j of [-1, 0, 1]) {
      const nLat = lat + i * dLat;
      if (nLat > 90 || nLat < -90) continue;
      let nLng = lng + j * dLng;
      if (nLng > 180) nLng -= 360;
      if (nLng < -180) nLng += 360;
      cells.add(encode(nLat, nLng, hash.length));
    }
  }
  return [...cells];
}
