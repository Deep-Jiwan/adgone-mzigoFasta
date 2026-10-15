import { Circle, Path, Svg } from "./svg";

type Spec = { d?: string[]; circles?: [number, number, number][] };

const ICONS = {
  home: { d: ["M3 11l9-8 9 8", "M5 10v10h14V10", "M10 20v-6h4v6"] },
  box: { d: ["M21 8l-9-5-9 5v8l9 5 9-5V8z", "M3 8l9 5 9-5", "M12 13v8"] },
  plus: { d: ["M12 5v14M5 12h14"] },
  pin: { d: ["M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"], circles: [[12, 10, 2.5]] },
  user: { d: ["M4 21c0-4 3.6-6 8-6s8 2 8 6"], circles: [[12, 8, 4]] },
  bell: { d: ["M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2z", "M10 21h4"] },
  search: { d: ["M20 20l-4-4"], circles: [[11, 11, 7]] },
  scan: { d: ["M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3", "M4 12h16"] },
  truck: { d: ["M2 6h12v10H2z", "M14 9h4l4 4v3h-8"], circles: [[6, 18, 2], [17, 18, 2]] },
  phone: { d: ["M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"] },
  chat: { d: ["M4 5h16v11H9l-5 4V5z"] },
  send: { d: ["M3 11l18-8-8 18-2-8-8-2z"] },
  back: { d: ["M15 5l-7 7 7 7"] },
  more: { circles: [[12, 5, 1.2], [12, 12, 1.2], [12, 19, 1.2]] },
  check: { d: ["M5 12l5 5 9-10"] },
  clock: { d: ["M12 7v5l3 2"], circles: [[12, 12, 9]] },
  wallet: { d: ["M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z", "M3 7l2-3h12"], circles: [[16, 13, 1]] },
  chart: { d: ["M4 20V10M10 20V4M16 20v-8M22 20H2"] },
  users: { d: ["M2 20c0-3.5 3-5 7-5s7 1.5 7 5", "M17 5a3 3 0 010 6M22 20c0-2.5-1.5-4-4-4.7"], circles: [[9, 8, 3.5]] },
  shield: { d: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z", "M9 12l2 2 4-4"] },
  sliders: { d: ["M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"], circles: [[15, 6, 2], [9, 12, 2], [17, 18, 2]] },
  map: { d: ["M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z", "M9 4v14M15 6v14"] },
  list: { d: ["M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"] },
  close: { d: ["M6 6l12 12M18 6L6 18"] },
  star: { d: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"] },
  nav: { d: ["M12 3l7 17-7-4-7 4 7-17z"] },
  cash: { d: ["M3 6h18v12H3z", "M6 9h.01M18 15h.01"], circles: [[12, 12, 3]] },
  qr: { d: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z", "M14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2"] },
  logout: { d: ["M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"] },
  camera: { d: ["M4 8h3l2-3h6l2 3h3v11H4z"], circles: [[12, 13, 3.5]] },
  alert: { d: ["M12 3l10 18H2L12 3z", "M12 10v5M12 18h.01"] },
  ban: { d: ["M5.6 5.6l12.8 12.8"], circles: [[12, 12, 9]] },
  link: { d: ["M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"] },
  share: { d: ["M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"] },
  bike: { d: ["M5.5 17L9 9h5l4.5 8M14 9l-1.5-3H10"], circles: [[5.5, 17, 3], [18.5, 17, 3]] },
  tuk: { d: ["M3 16V9l4-4h9l3 5v6M3 16h16"], circles: [[7, 18, 2], [17, 18, 2]] },
  pickup: { d: ["M2 9h11v7H2zM13 11h5l4 3v2h-9"], circles: [[6, 18, 2], [18, 18, 2]] },
  info: { d: ["M12 11v5M12 8h.01"], circles: [[12, 12, 9]] },
  chevron: { d: ["M9 6l6 6-6 6"] },
  download: { d: ["M12 4v11M7 11l5 5 5-5M5 20h14"] },
  filter: { d: ["M3 5h18l-7 8v6l-4-2v-4L3 5z"] },
  globe: { d: ["M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"], circles: [[12, 12, 9]] },
  lock: { d: ["M6 11h12v9H6z", "M8 11V8a4 4 0 018 0v3"] },
} satisfies Record<string, Spec>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color = "#060606", strokeWidth = 1.8, fill }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string;
}) {
  const spec: Spec = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {spec.d?.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={fill ?? "none"} />
      ))}
      {spec.circles?.map(([cx, cy, r], i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill={r < 2 ? color : (fill ?? "none")} />
      ))}
    </Svg>
  );
}
