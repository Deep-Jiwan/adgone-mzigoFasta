import { useMemo } from "react";
import { View } from "react-native";
import { Circle, G, Path, Polygon, Rect, Svg } from "./svg";
import { c } from "../theme";

// Placeholder map: a stylised street grid with a stepped route, like the reference design.
// Swap this component for MapLibre / Google Maps once the provider is chosen (Q-21); the props stay the same.

export interface LatLng { lat: number; lng: number }
export interface MapMarker extends LatLng { tone?: "dark" | "orange" | "green" | "grey"; id?: string }
interface Props {
  pickup?: LatLng; dropoff?: LatLng; markers?: MapMarker[];
  phase?: "toPickup" | "toDropoff" | "none"; leg?: number;
  height?: number | string; seed?: string; rounded?: number;
}

const W = 400, H = 300;

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
}

type Pt = { x: number; y: number };
function pointAt(path: Pt[], t: number): { p: Pt; angle: number } {
  const segs = path.slice(1).map((b, i) => ({ a: path[i]!, b, len: Math.hypot(b.x - path[i]!.x, b.y - path[i]!.y) }));
  const total = segs.reduce((n, s) => n + s.len, 0) || 1;
  let want = Math.min(1, Math.max(0, t)) * total;
  for (const s of segs) {
    if (want <= s.len || s === segs[segs.length - 1]) {
      const f = s.len ? Math.min(1, want / s.len) : 0;
      return { p: { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f }, angle: (Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) * 180) / Math.PI + 90 };
    }
    want -= s.len;
  }
  return { p: path[0]!, angle: 0 };
}
const stepped = (a: Pt, b: Pt): Pt[] => {
  const ym = (a.y + b.y) / 2;
  return [a, { x: a.x, y: ym }, { x: b.x, y: ym }, b];
};
const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

export function MapView({ pickup, dropoff, markers = [], phase = "none", leg = 0, height = 300, seed = "dar", rounded = 0 }: Props) {
  const scene = useMemo(() => {
    const r = rng(seed);
    const roads: string[] = [];
    for (let i = 0; i < 9; i++) { const y = 20 + i * 34 + r() * 14; roads.push(`M-10 ${y} L${W + 10} ${y + (r() - 0.5) * 18}`); }
    for (let i = 0; i < 11; i++) { const x = 10 + i * 38 + r() * 14; roads.push(`M${x} -10 L${x + (r() - 0.5) * 22} ${H + 10}`); }
    const arterials = [`M-10 ${60 + r() * 160} C120 ${r() * H}, 260 ${r() * H}, ${W + 10} ${40 + r() * 200}`, `M${60 + r() * 280} -10 C${r() * W} 100, ${r() * W} 200, ${60 + r() * 280} ${H + 10}`];
    const parks = Array.from({ length: 3 }, () => ({ x: r() * (W - 90), y: r() * (H - 70), w: 50 + r() * 50, h: 34 + r() * 30 }));
    const water = `M${W - 70 - r() * 40} -10 C${W - 90} 80, ${W - 40 - r() * 40} 160, ${W - 80} ${H + 10} L${W + 10} ${H + 10} L${W + 10} -10 Z`;
    return { roads, arterials, parks, water };
  }, [seed]);

  const all: LatLng[] = [pickup, dropoff, ...markers].filter(Boolean) as LatLng[];
  const proj = useMemo(() => {
    const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.35, 0.006), padLng = Math.max((maxLng - minLng) * 0.35, 0.008);
    const a = minLat - padLat, b = maxLat + padLat, l = minLng - padLng, rr = maxLng + padLng;
    return (p: LatLng): Pt => ({ x: ((p.lng - l) / (rr - l)) * W, y: (1 - (p.lat - a) / (b - a)) * H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, markers.length]);

  const A = pickup ? proj(pickup) : undefined;
  const B = dropoff ? proj(dropoff) : undefined;
  const route = A && B ? stepped(A, B) : undefined;
  const r2 = rng(seed + "drv");
  const start: Pt | undefined = A ? { x: Math.min(W - 24, Math.max(24, A.x - 70 + r2() * 30)), y: Math.min(H - 24, Math.max(24, A.y + 60 - r2() * 20)) } : undefined;
  const toPickup = A && start ? stepped(start, A) : undefined;

  let driver: { p: Pt; angle: number } | undefined;
  if (phase === "toDropoff" && route) driver = pointAt(route, leg);
  if (phase === "toPickup" && toPickup) driver = pointAt(toPickup, leg);

  const tone = { dark: c.ink, orange: c.orange, green: c.green, grey: "#9AA0A6" };

  return (
    <View style={{ height: height as number, overflow: "hidden", borderRadius: rounded, backgroundColor: c.mapLand }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Rect width={W} height={H} fill={c.mapLand} />
        <Path d={scene.water} fill={c.mapWater} />
        {scene.parks.map((p, i) => <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={8} fill={c.mapPark} />)}
        {scene.roads.map((p, i) => <Path key={i} d={p} stroke={c.mapRoad} strokeWidth={5} fill="none" />)}
        {scene.arterials.map((p, i) => <Path key={`a${i}`} d={p} stroke="#fff" strokeWidth={9} fill="none" />)}
        {route ? (
          <>
            <Path d={d(route)} stroke="#B9BDC2" strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {phase === "toDropoff" && driver ? <Path d={d(route)} stroke={c.ink} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          </>
        ) : null}
        {toPickup && phase === "toPickup" ? <Path d={d(toPickup)} stroke={c.ink} strokeWidth={4} strokeDasharray="2 7" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {markers.map((m, i) => { const p = proj(m); return <G key={m.id ?? i}><Circle cx={p.x} cy={p.y} r={11} fill={tone[m.tone ?? "dark"]} opacity={0.16} /><Circle cx={p.x} cy={p.y} r={5.5} fill={tone[m.tone ?? "dark"]} stroke="#fff" strokeWidth={2} /></G>; })}
        {A ? <G><Circle cx={A.x} cy={A.y} r={9} fill="#fff" stroke={c.ink} strokeWidth={3} /></G> : null}
        {B ? <G><Circle cx={B.x} cy={B.y} r={22} fill={c.orange} opacity={0.18} /><Circle cx={B.x} cy={B.y} r={12} fill={c.orange} opacity={0.35} /><Circle cx={B.x} cy={B.y} r={6.5} fill={c.orange} stroke="#fff" strokeWidth={2.5} /></G> : null}
        {driver ? (
          <G transform={`translate(${driver.p.x} ${driver.p.y})`}>
            <Circle r={20} fill="#000" opacity={0.08} />
            <Circle r={15} fill={c.ink} stroke="#fff" strokeWidth={3} />
            <G transform={`rotate(${driver.angle})`}><Polygon points="0,-7 5.5,6 0,3 -5.5,6" fill="#fff" /></G>
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
