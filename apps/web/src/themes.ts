// Visual themes. The app reads everything from the active theme (theme.ts), so a theme is a
// palette plus a few structural choices: navigation style, progress-stepper style, card edges, fonts.
// "classic" is the first build, faithful to the Couriq reference; the other three are variations.

export interface Palette {
  ink: string; text: string; onInk: string; selected: string; onSelected: string;
  sheet: string; sheet2: string; panel: string; panel2: string; onPanel: string; onPanelMuted: string;
  paper: string; canvas: string; surface: string; line: string; muted: string; slate: string;
  accent: string; accentDeep: string; accentSoft: string; onAccent: string;
  green: string; greenSoft: string; red: string; redSoft: string; blue: string; blueSoft: string; amber: string; amberSoft: string;
  mapLand: string; mapRoad: string; mapPark: string; mapWater: string;
  routeIdle: string; routeActive: string; markerFill: string; markerFg: string; markerRing: string;
  artA: string; artB: string;
  navBg: string; navBorder: string; navActive: string; navIdle: string; navCapsule: string; navCenterBg: string; navCenterRing: string; navCenterFg: string;
  stepIdle: string; stepIdlePanel: string; stepLineIdle: string; stepLineIdlePanel: string;
  side: string; sideActive: string; onSide: string; onSideMuted: string; toggleOff: string;
}

export interface Theme {
  key: ThemeKey;
  label: string;
  colors: Palette;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  shadow: { card: string; float: string };
  font: { body: string; display: string };
  type: { displaySize: number; displayWeight: "500" | "600" | "700"; titleWeight: "500" | "600" | "700"; displayTracking: number };
  nav: "pill" | "bar" | "dock";
  stepper: "dots" | "line" | "segments";
  cardEdge: "shadow" | "hairline";
}

export type ThemeKey = "classic" | "pwani" | "usiku" | "savanna";

const classic: Palette = {
  ink: "#060606", text: "#060606", onInk: "#FFFFFF", selected: "#060606", onSelected: "#FFFFFF",
  sheet: "#1E1E20", sheet2: "#2A2A2D", panel: "#1E1E20", panel2: "#2A2A2D", onPanel: "#FFFFFF", onPanelMuted: "#9A9AA1",
  paper: "#FAFAFA", canvas: "#F3F3F3", surface: "#FFFFFF", line: "#ECECEC", muted: "#8A8A90", slate: "#667589",
  accent: "#E88E40", accentDeep: "#D15F26", accentSoft: "#FDF1E6", onAccent: "#FFFFFF",
  green: "#2F9E6B", greenSoft: "#E6F5EE", red: "#D64545", redSoft: "#FBE9E9", blue: "#3C6FD6", blueSoft: "#E8EEFB", amber: "#C98A12", amberSoft: "#FBF3DC",
  mapLand: "#EEF0F1", mapRoad: "#FFFFFF", mapPark: "#E2EBE0", mapWater: "#DCE6EE",
  routeIdle: "#B9BDC2", routeActive: "#060606", markerFill: "#060606", markerFg: "#FFFFFF", markerRing: "#FFFFFF",
  artA: "#F26B4F", artB: "#D2442E",
  navBg: "#060606", navBorder: "transparent", navActive: "#FFFFFF", navIdle: "#8D8D93", navCapsule: "#2A2A2D", navCenterBg: "#FFFFFF", navCenterRing: "#E88E40", navCenterFg: "#060606",
  stepIdle: "#E4E4E7", stepIdlePanel: "#3A3A3F", stepLineIdle: "#D8D8DC", stepLineIdlePanel: "#4A4A50",
  side: "#060606", sideActive: "#2A2A2D", onSide: "#FFFFFF", onSideMuted: "#B5B5BB", toggleOff: "#D4D4D8",
};

// Pwani ("coast"): Apple-style light. System blue, grouped grey background, hairline cards,
// a frosted tab bar, a solid progress line, large bold titles.
const pwani: Palette = {
  ...classic,
  ink: "#1C1C1E", text: "#111114", selected: "#1C1C1E", onSelected: "#FFFFFF",
  sheet: "#1C1C1E", sheet2: "#2C2C2E", panel: "#FFFFFF", panel2: "#F2F2F7", onPanel: "#111114", onPanelMuted: "#8E8E93",
  paper: "#F2F2F7", canvas: "#F2F2F7", surface: "#FFFFFF", line: "#E5E5EA", muted: "#8E8E93", slate: "#636366",
  accent: "#0A7AFF", accentDeep: "#0062D6", accentSoft: "#E6F1FF", onAccent: "#FFFFFF",
  green: "#2A9F4B", greenSoft: "#E5F6EA", red: "#E5372D", redSoft: "#FFEBEA", blue: "#5856D6", blueSoft: "#EEEDFB", amber: "#B97400", amberSoft: "#FFF3D9",
  mapLand: "#EBEDF0", mapRoad: "#FFFFFF", mapPark: "#DCEAD7", mapWater: "#CFE1F3",
  routeIdle: "#B4C6E0", routeActive: "#0A7AFF", markerFill: "#0A7AFF", markerFg: "#FFFFFF", markerRing: "#FFFFFF",
  artA: "#4DA3FF", artB: "#0A64D6",
  navBg: "rgba(250,250,252,0.82)", navBorder: "#D1D1D6", navActive: "#0A7AFF", navIdle: "#8E8E93", navCapsule: "#E6F1FF", navCenterBg: "#0A7AFF", navCenterRing: "transparent", navCenterFg: "#FFFFFF",
  stepIdle: "#E5E5EA", stepIdlePanel: "#E5E5EA", stepLineIdle: "#D1D1D6", stepLineIdlePanel: "#D1D1D6",
  side: "#F7F7FA", sideActive: "#E5E5EA", onSide: "#111114", onSideMuted: "#636366", toggleOff: "#D1D1D6",
};

// Usiku ("night"): dark first, for night shifts and 24/7 operation. Near-black with one electric
// lime accent, a segmented progress bar, dark map, light pills for selected states.
const usiku: Palette = {
  ...classic,
  ink: "#2C2C31", text: "#F5F5F7", onInk: "#FFFFFF", selected: "#F5F5F7", onSelected: "#0B0B0D",
  sheet: "#1F1F24", sheet2: "#2B2B31", panel: "#17171A", panel2: "#232327", onPanel: "#F5F5F7", onPanelMuted: "#8B8B93",
  paper: "#0B0B0D", canvas: "#232327", surface: "#161619", line: "#2B2B30", muted: "#8B8B93", slate: "#A8A8B0",
  accent: "#C6F135", accentDeep: "#BEE82E", accentSoft: "#27310F", onAccent: "#0B0B0D",
  green: "#32D74B", greenSoft: "#10301A", red: "#FF6259", redSoft: "#3B1816", blue: "#5EA6FF", blueSoft: "#13263F", amber: "#FFD60A", amberSoft: "#33290A",
  mapLand: "#14161A", mapRoad: "#23262C", mapPark: "#16231B", mapWater: "#111C2A",
  routeIdle: "#3A3F48", routeActive: "#C6F135", markerFill: "#C6F135", markerFg: "#0B0B0D", markerRing: "#0B0B0D",
  artA: "#D5F75E", artB: "#9CC617",
  navBg: "#232327", navBorder: "#34343A", navActive: "#C6F135", navIdle: "#8B8B93", navCapsule: "#2B2B31", navCenterBg: "#C6F135", navCenterRing: "#0B0B0D", navCenterFg: "#0B0B0D",
  stepIdle: "#2B2B30", stepIdlePanel: "#2B2B30", stepLineIdle: "#34343A", stepLineIdlePanel: "#34343A",
  side: "#0B0B0D", sideActive: "#232327", onSide: "#F5F5F7", onSideMuted: "#8B8B93", toggleOff: "#3A3A40",
};

// Savanna: warm and editorial. Cream paper, deep forest green, marigold accent, a serif for
// titles and numbers, a floating dock whose active tab becomes a labelled capsule.
const savanna: Palette = {
  ...classic,
  ink: "#16382C", text: "#16382C", selected: "#16382C", onSelected: "#FFFCF5",
  sheet: "#16382C", sheet2: "#21493B", panel: "#16382C", panel2: "#21493B", onPanel: "#FFFCF5", onPanelMuted: "#A9BBB0",
  paper: "#F4EFE4", canvas: "#ECE5D6", surface: "#FFFCF5", line: "#E3DBC8", muted: "#82897C", slate: "#5A6B5F",
  accent: "#E7A416", accentDeep: "#8F5F00", accentSoft: "#FBF0D0", onAccent: "#16382C",
  green: "#2F7D4F", greenSoft: "#E1F0E4", red: "#B8432C", redSoft: "#F6E1DB", blue: "#2C6A93", blueSoft: "#DEEBF2", amber: "#8F5F00", amberSoft: "#F8ECC9",
  mapLand: "#E9E3D2", mapRoad: "#FBF7EC", mapPark: "#D5E2C3", mapWater: "#CBDFE0",
  routeIdle: "#C2B99F", routeActive: "#16382C", markerFill: "#16382C", markerFg: "#FFFCF5", markerRing: "#FFFCF5",
  artA: "#2F8F63", artB: "#16684A",
  navBg: "#16382C", navBorder: "transparent", navActive: "#16382C", navIdle: "#9DB5A8", navCapsule: "#F4EFE4", navCenterBg: "#E7A416", navCenterRing: "#F4EFE4", navCenterFg: "#16382C",
  stepIdle: "#E3DBC8", stepIdlePanel: "#2E5748", stepLineIdle: "#D5CCB7", stepLineIdlePanel: "#3C6555",
  side: "#16382C", sideActive: "#21493B", onSide: "#FFFCF5", onSideMuted: "#A9BBB0", toggleOff: "#CFC7B3",
};

const SYSTEM = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export const THEMES: Record<ThemeKey, Theme> = {
  classic: {
    key: "classic", label: "Classic", colors: classic,
    radius: { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 },
    shadow: { card: "0 1px 2px rgba(6,6,6,0.04), 0 8px 24px rgba(6,6,6,0.05)", float: "0 10px 30px rgba(6,6,6,0.28)" },
    font: { body: `"Inter Variable", Inter, ${SYSTEM}`, display: `"Inter Variable", Inter, ${SYSTEM}` },
    type: { displaySize: 30, displayWeight: "600", titleWeight: "600", displayTracking: -0.8 },
    nav: "pill", stepper: "dots", cardEdge: "shadow",
  },
  pwani: {
    key: "pwani", label: "Pwani", colors: pwani,
    radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
    shadow: { card: "none", float: "0 8px 30px rgba(0,0,0,0.12)" },
    font: { body: `"Inter Variable", Inter, -apple-system, ${SYSTEM}`, display: `"Inter Variable", Inter, -apple-system, ${SYSTEM}` },
    type: { displaySize: 34, displayWeight: "700", titleWeight: "700", displayTracking: -1.1 },
    nav: "bar", stepper: "line", cardEdge: "hairline",
  },
  usiku: {
    key: "usiku", label: "Usiku", colors: usiku,
    radius: { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 },
    shadow: { card: "none", float: "0 12px 34px rgba(0,0,0,0.6)" },
    font: { body: `"Manrope Variable", Manrope, ${SYSTEM}`, display: `"Manrope Variable", Manrope, ${SYSTEM}` },
    type: { displaySize: 30, displayWeight: "700", titleWeight: "700", displayTracking: -0.9 },
    nav: "pill", stepper: "segments", cardEdge: "hairline",
  },
  savanna: {
    key: "savanna", label: "Savanna", colors: savanna,
    radius: { sm: 12, md: 18, lg: 28, xl: 36, pill: 999 },
    shadow: { card: "0 1px 2px rgba(60,40,10,0.05), 0 10px 28px rgba(60,40,10,0.07)", float: "0 12px 30px rgba(22,56,44,0.35)" },
    font: { body: `"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ${SYSTEM}`, display: `"Fraunces Variable", Fraunces, Georgia, serif` },
    type: { displaySize: 32, displayWeight: "600", titleWeight: "600", displayTracking: -0.6 },
    nav: "dock", stepper: "dots", cardEdge: "shadow",
  },
};
