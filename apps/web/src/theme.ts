import { type TextStyle } from "react-native";
import { THEMES, type Palette, type Theme, type ThemeKey } from "./themes";

// The active theme is chosen once at load: ?theme=pwani|usiku|savanna|classic (remembered in localStorage).
function pick(): ThemeKey {
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q && q in THEMES) {
      localStorage.setItem("mzigo-theme", q);
      return q as ThemeKey;
    }
    const saved = localStorage.getItem("mzigo-theme");
    if (saved && saved in THEMES) return saved as ThemeKey;
  } catch { /* no storage or no window: fall through */ }
  return "classic";
}

export const theme: Theme = THEMES[pick()];
export const c: Palette = theme.colors;
export const radius = theme.radius;
export const shadow = theme.shadow;
export const font = theme.font;

export const BREAKPOINT_DESKTOP = 900;

/** Web-only style bits that React Native's types don't know about. */
export const noOutline = { outlineStyle: "none" } as unknown as TextStyle;
export const cursor = (v: "pointer" | "default" | "not-allowed") => v as "pointer";
export const blur = (px: number) => ({ backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)` }) as unknown as object;
