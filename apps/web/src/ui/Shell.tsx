import { type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { c, shadow } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Row, T, useIsDesktop } from "./kit";

/** Customer, driver and public views are phone-first; on a desktop they sit inside a phone-shaped frame. */
export function PhoneFrame({ children, switcher = true }: { children: ReactNode; switcher?: boolean }) {
  const desktop = useIsDesktop();
  if (!desktop) return <View style={{ flex: 1, backgroundColor: c.paper }}>{children}</View>;
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 48, padding: 24 }}>
      {switcher ? <RoleSwitcher /> : null}
      <View
        style={{
          width: 414, height: "100%", maxHeight: 880, borderRadius: 48, backgroundColor: c.paper, overflow: "hidden", borderWidth: 9, borderColor: "#0C0C0D",
          boxShadow: "0 30px 80px rgba(6,6,6,0.25)",
        }}
      >
        {children}
      </View>
    </View>
  );
}

const ROLES = [
  { label: "Customer", sub: "Request deliveries", to: "/customer", icon: "box" },
  { label: "Driver", sub: "Take jobs", to: "/driver", icon: "bike" },
  { label: "Public link", sub: "What the recipient sees", to: "/t/tk_mf24817x9f2", icon: "link" },
  { label: "Admin", sub: "Run everything", to: "/admin", icon: "sliders" },
] as const;

export function RoleSwitcher() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <View style={{ width: 240, gap: 8 }}>
      <Pressable onPress={() => nav("/")}><T v="title" style={{ marginBottom: 2 }}>MzigoFasta</T></Pressable>
      <T v="small" color={c.muted} style={{ marginBottom: 12 }}>Design prototype. Everything you do is shared between roles.</T>
      {ROLES.map((r) => {
        const active = pathname.startsWith(r.to.split("/").slice(0, 2).join("/"));
        return (
          <Pressable
            key={r.label} onPress={() => nav(r.to)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: active ? c.ink : c.surface, cursor: "pointer" }}
          >
            <Icon name={r.icon as IconName} size={20} color={active ? "#fff" : c.ink} />
            <View><T v="small" weight="600" color={active ? "#fff" : c.ink}>{r.label}</T><T v="tiny" color={active ? "#B5B5BB" : c.muted}>{r.sub}</T></View>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface NavItem { to: string; label: string; icon: IconName; center?: boolean; match?: string[] }

export function FloatingNav({ items }: { items: NavItem[] }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <View style={{ position: "absolute", left: 14, right: 14, bottom: 18, alignItems: "center" }} pointerEvents="box-none">
      <Row
        justify="space-between"
        style={{
          backgroundColor: c.ink, borderRadius: 40, paddingHorizontal: 18, paddingVertical: 10, width: "100%",
          boxShadow: shadow.float,
        }}
        gap={0}
      >
        {items.map((it) => {
          const active = it.match ? it.match.some((m) => pathname.startsWith(m)) : pathname === it.to;
          if (it.center) {
            return (
              <Pressable key={it.label} onPress={() => nav(it.to)} style={{ marginTop: -22, width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff", borderWidth: 4, borderColor: c.orange, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon name={it.icon} size={28} color={c.ink} strokeWidth={2.2} />
              </Pressable>
            );
          }
          return (
            <Pressable key={it.label} onPress={() => nav(it.to)} style={{ alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6, minWidth: 56, cursor: "pointer" }}>
              <Icon name={it.icon} size={22} color={active ? "#fff" : "#8D8D93"} fill={active ? "#fff" : "none"} />
              <T v="tiny" color={active ? "#fff" : "#8D8D93"} weight={active ? "600" : "500"}>{it.label}</T>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

/** Bottom sheet that sits over a map, as in the reference tracking screen. */
export function Sheet({ children, dark = true, maxHeight }: { children: ReactNode; dark?: boolean; maxHeight?: number }) {
  return (
    <View style={{ backgroundColor: dark ? c.sheet : c.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1, maxHeight }}>
      <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: dark ? "#4A4A50" : "#D8D8DC", marginTop: 10 }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
  );
}
