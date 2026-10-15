import { type TextStyle } from "react-native";

// Design tokens, taken from the Couriq reference (docs/design/reference): near-black ink,
// warm off-white surfaces, and an orange accent used sparingly for progress and primary actions.
export const c = {
  ink: "#060606",
  sheet: "#1E1E20",
  sheet2: "#2A2A2D",
  paper: "#FAFAFA",
  canvas: "#F3F3F3",
  surface: "#FFFFFF",
  line: "#ECECEC",
  muted: "#8A8A90",
  slate: "#667589",
  orange: "#E88E40",
  orangeDeep: "#D15F26",
  orangeSoft: "#FDF1E6",
  green: "#2F9E6B",
  greenSoft: "#E6F5EE",
  red: "#D64545",
  redSoft: "#FBE9E9",
  blue: "#3C6FD6",
  blueSoft: "#E8EEFB",
  amber: "#C98A12",
  amberSoft: "#FBF3DC",
  mapLand: "#EEF0F1",
  mapRoad: "#FFFFFF",
  mapPark: "#E2EBE0",
  mapWater: "#DCE6EE",
} as const;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const shadow = {
  card: "0 1px 2px rgba(6,6,6,0.04), 0 8px 24px rgba(6,6,6,0.05)",
  float: "0 10px 30px rgba(6,6,6,0.28)",
} as const;

export const BREAKPOINT_DESKTOP = 900;

/** Web-only style bits that React Native's types don't know about. */
export const noOutline = { outlineStyle: "none" } as unknown as TextStyle;
export const cursor = (v: "pointer" | "default" | "not-allowed") => v as "pointer";
