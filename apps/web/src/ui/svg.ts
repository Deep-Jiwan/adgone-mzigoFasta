import { type ComponentType, type ReactNode } from "react";
import * as RNSvg from "react-native-svg";

// react-native-svg's class typings don't resolve React's `Component` under pnpm's strict layout,
// so JSX on them fails to typecheck. Re-export the primitives with a loose prop type; the runtime is unchanged.
type Loose = ComponentType<Record<string, unknown> & { children?: ReactNode }>;
const L = (x: unknown) => x as Loose;

export const Svg = L(RNSvg.default);
export const Circle = L(RNSvg.Circle);
export const Path = L(RNSvg.Path);
export const Rect = L(RNSvg.Rect);
export const G = L(RNSvg.G);
export const Polygon = L(RNSvg.Polygon);
export const Defs = L(RNSvg.Defs);
export const LinearGradient = L(RNSvg.LinearGradient);
export const Stop = L(RNSvg.Stop);
