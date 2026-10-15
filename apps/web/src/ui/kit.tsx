import { type ReactNode, useEffect, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { BREAKPOINT_DESKTOP, c, cursor, noOutline, radius, shadow } from "../theme";
import { Icon, type IconName } from "./Icon";

export function useIsDesktop() {
  return useWindowDimensions().width >= BREAKPOINT_DESKTOP;
}

/* ---------- text ---------- */
type Variant = "display" | "title" | "h2" | "body" | "small" | "tiny";
const TEXT: Record<Variant, TextStyle> = {
  display: { fontSize: 30, fontWeight: "600", letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.4 },
  h2: { fontSize: 17, fontWeight: "500", letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "400" },
  small: { fontSize: 13, fontWeight: "400" },
  tiny: { fontSize: 11, fontWeight: "500", letterSpacing: 0.2 },
};

export function T({ v = "body", color = c.ink, weight, style, children, numberOfLines }: {
  v?: Variant; color?: string; weight?: TextStyle["fontWeight"]; style?: StyleProp<TextStyle>;
  children?: ReactNode; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: "Inter, system-ui, sans-serif", color }, TEXT[v], weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
}

export const Muted = (p: { children?: ReactNode; v?: Variant; style?: StyleProp<TextStyle>; numberOfLines?: number }) => (
  <T v={p.v ?? "small"} color={c.muted} style={p.style} numberOfLines={p.numberOfLines}>{p.children}</T>
);

/* ---------- surfaces ---------- */
export function Card({ children, style, dark, onPress }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean; onPress?: () => void;
}) {
  const base: ViewStyle = {
    backgroundColor: dark ? c.sheet : c.surface, borderRadius: radius.lg, padding: 16,
    boxShadow: dark ? undefined : shadow.card,
  };
  if (onPress) return <Pressable onPress={onPress} style={[base, { cursor: "pointer" }, style]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

export function Row({ children, style, gap = 10, align = "center", justify }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle["alignItems"]; justify?: ViewStyle["justifyContent"];
}) {
  return <View style={[{ flexDirection: "row", alignItems: align, gap, justifyContent: justify }, style]}>{children}</View>;
}

export const Divider = ({ dark }: { dark?: boolean }) => (
  <View style={{ height: 1, backgroundColor: dark ? "#34343A" : c.line, marginVertical: 12 }} />
);

/* ---------- badges, chips ---------- */
export type Tone = "neutral" | "orange" | "green" | "red" | "blue" | "amber" | "dark";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: c.canvas, fg: c.slate },
  orange: { bg: c.orangeSoft, fg: c.orangeDeep },
  green: { bg: c.greenSoft, fg: c.green },
  red: { bg: c.redSoft, fg: c.red },
  blue: { bg: c.blueSoft, fg: c.blue },
  amber: { bg: c.amberSoft, fg: c.amber },
  dark: { bg: c.ink, fg: "#fff" },
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={{ backgroundColor: t.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <T v="tiny" color={t.fg} weight="600">{children}</T>
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill,
        backgroundColor: active ? c.ink : c.surface, borderWidth: 1, borderColor: active ? c.ink : c.line, cursor: "pointer",
      }}
    >
      {icon ? <Icon name={icon} size={15} color={active ? "#fff" : c.slate} /> : null}
      <T v="small" color={active ? "#fff" : c.ink} weight="500">{label}</T>
    </Pressable>
  );
}

/* ---------- buttons ---------- */
export function Button({ label, onPress, variant = "dark", icon, disabled, small, full = true, style }: {
  label: string; onPress?: () => void; variant?: "dark" | "orange" | "light" | "ghost" | "danger"; icon?: IconName;
  disabled?: boolean; small?: boolean; full?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const map = {
    dark: { bg: c.ink, fg: "#fff", bd: c.ink },
    orange: { bg: c.orange, fg: "#fff", bd: c.orange },
    light: { bg: c.surface, fg: c.ink, bd: c.line },
    ghost: { bg: "transparent", fg: c.ink, bd: "transparent" },
    danger: { bg: c.redSoft, fg: c.red, bd: c.redSoft },
  }[variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.pill,
          paddingVertical: small ? 10 : 16, paddingHorizontal: small ? 16 : 22, backgroundColor: map.bg, borderWidth: 1, borderColor: map.bd,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1, cursor: cursor(disabled ? "not-allowed" : "pointer"), alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 16 : 19} color={map.fg} /> : null}
      <T v={small ? "small" : "body"} color={map.fg} weight="600">{label}</T>
    </Pressable>
  );
}

export function RoundButton({ icon, onPress, bg = c.ink, fg = "#fff", size = 48, badge }: {
  icon: IconName; onPress?: () => void; bg?: string; fg?: string; size?: number; badge?: number;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <Icon name={icon} size={size * 0.44} color={fg} />
      {badge ? (
        <View style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.orange, alignItems: "center", justifyContent: "center" }}>
          <T v="tiny" color="#fff" style={{ fontSize: 9 }}>{badge}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ---------- inputs ---------- */
export function Field({ label, value, onChangeText, placeholder, icon, keyboardType, multiline, prefix, dark }: {
  label?: string; value: string; onChangeText: (s: string) => void; placeholder?: string; icon?: IconName;
  keyboardType?: "default" | "numeric" | "phone-pad"; multiline?: boolean; prefix?: string; dark?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" color={dark ? "#B5B5BB" : c.slate} weight="500">{label}</T> : null}
      <Row style={{ backgroundColor: dark ? c.sheet2 : c.canvas, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50 }} gap={10}>
        {icon ? <Icon name={icon} size={18} color={c.muted} /> : null}
        {prefix ? <T v="body" color={c.muted}>{prefix}</T> : null}
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted} keyboardType={keyboardType} multiline={multiline}
          style={[{ flex: 1, fontSize: 15, color: dark ? "#fff" : c.ink, paddingVertical: 14, fontFamily: "Inter, system-ui, sans-serif" }, noOutline]}
        />
      </Row>
    </View>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!on)}
      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: on ? c.orange : "#D4D4D8", padding: 3, opacity: disabled ? 0.5 : 1, cursor: cursor(disabled ? "not-allowed" : "pointer") }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", marginLeft: on ? 20 : 0 }} />
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: {
  options: { key: K; label: string; disabled?: boolean }[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <Row gap={4} style={{ backgroundColor: c.canvas, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => (
        <Pressable
          key={o.key} onPress={() => !o.disabled && onChange(o.key)}
          style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill, backgroundColor: value === o.key ? c.ink : "transparent", opacity: o.disabled ? 0.4 : 1, cursor: "pointer" }}
        >
          <T v="small" weight="500" color={value === o.key ? "#fff" : c.slate}>{o.label}</T>
        </Pressable>
      ))}
    </Row>
  );
}

/* ---------- people ---------- */
const AVATAR_COLORS = ["#E88E40", "#3C6FD6", "#2F9E6B", "#8E5BD6", "#D64545", "#667589"];
export function Avatar({ name, size = 44, ring }: { name: string; size?: number; ring?: boolean }) {
  const idx = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_COLORS[idx], alignItems: "center", justifyContent: "center", borderWidth: ring ? 2 : 0, borderColor: "#fff" }}>
      <T v="small" color="#fff" weight="600" style={{ fontSize: size * 0.34 }}>{initials}</T>
    </View>
  );
}

/* ---------- progress (the dotted stepper from the reference) ---------- */
export function DotStepper({ steps, done, dark, truckAt }: { steps: number; done: number; dark?: boolean; truckAt?: number }) {
  return (
    <Row gap={0} style={{ alignSelf: "stretch", minWidth: 0 }}>
      {Array.from({ length: steps }).map((_, i) => {
        const complete = i < done;
        const current = truckAt === i;
        return (
          <Row key={i} gap={0} style={i === steps - 1 ? { flexGrow: 0, flexShrink: 0 } : { flex: 1, minWidth: 0 }}>
            <View
              style={{
                width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
                backgroundColor: complete ? c.orangeSoft : current ? c.orange : dark ? "#3A3A3F" : "#E4E4E7",
                borderWidth: complete ? 1.5 : 0, borderColor: c.orange,
              }}
            >
              {complete ? <Icon name="check" size={12} color={c.orange} strokeWidth={3} /> : current ? <Icon name="truck" size={12} color="#fff" strokeWidth={2.2} /> : <Icon name="check" size={12} color={dark ? "#6A6A70" : "#B9B9BE"} strokeWidth={3} />}
            </View>
            {i < steps - 1 ? (
              <View style={{ flex: 1, minWidth: 0, height: 2, marginHorizontal: 4, borderRadius: 1, borderStyle: "dotted", borderTopWidth: 3, borderColor: i < done - 1 || (current && i < done) ? c.orange : i === done - 1 ? c.orange : dark ? "#4A4A50" : "#D8D8DC", marginTop: 1 }} />
            ) : null}
          </Row>
        );
      })}
    </Row>
  );
}

/* ---------- layout helpers ---------- */
export function Screen({ children, bottomPad = 0, bg = c.paper, scroll = true }: { children: ReactNode; bottomPad?: number; bg?: string; scroll?: boolean }) {
  if (!scroll) return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 + bottomPad, gap: 16 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row justify="space-between" style={{ paddingHorizontal: 4 }}>
      <T v="h2">{title}</T>
      {action ? <Pressable onPress={onAction}><T v="small" color={c.muted}>{action}</T></Pressable> : null}
    </Row>
  );
}

export function TopBar({ title, onBack, right, dark }: { title: string; onBack?: () => void; right?: ReactNode; dark?: boolean }) {
  return (
    <Row justify="space-between" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      {onBack ? <RoundButton icon="back" onPress={onBack} bg={dark ? c.sheet : c.surface} fg={dark ? "#fff" : c.ink} size={44} /> : <View style={{ width: 44 }} />}
      <T v="title" style={{ fontSize: 19 }}>{title}</T>
      {right ?? <View style={{ width: 44 }} />}
    </Row>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <View style={{ position: "absolute", top: 16, alignSelf: "center", backgroundColor: c.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, zIndex: 50 }} pointerEvents="none">
      <T v="small" color="#fff" weight="500">{msg}</T>
    </View>
  ) : null;
  return { show: setMsg, node };
}

export const styles = StyleSheet.create({ fill: { flex: 1 } });
export const money = (n: number) => `TZS ${n.toLocaleString("en-US")}`;
