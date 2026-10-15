import { type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { blur, c, radius, shadow, theme } from "../theme";
import { THEMES, type ThemeKey } from "../themes";
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
        testID="phone-frame"
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

export function ThemeSwitch() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
        const on = theme.key === k;
        return (
          <Pressable
            key={k} onPress={() => { window.location.search = `?theme=${k}`; }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: on ? c.text : c.line, backgroundColor: on ? c.selected : c.surface, cursor: "pointer" }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: THEMES[k].colors.accent }} />
            <T v="tiny" color={on ? c.onSelected : c.text} weight="600">{THEMES[k].label}</T>
          </Pressable>
        );
      })}
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
      <ThemeSwitch />
      {ROLES.map((r) => {
        const active = pathname.startsWith(r.to.split("/").slice(0, 2).join("/"));
        return (
          <Pressable
            key={r.label} onPress={() => nav(r.to)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: active ? c.ink : c.surface, cursor: "pointer" }}
          >
            <Icon name={r.icon as IconName} size={20} color={active ? "#fff" : c.text} />
            <View><T v="small" weight="600" color={active ? "#fff" : c.text}>{r.label}</T><T v="tiny" color={active ? "#B5B5BB" : c.muted}>{r.sub}</T></View>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface NavItem { to: string; label: string; icon: IconName; center?: boolean; match?: string[] }

// Three navigation styles, chosen by the theme:
//  pill: dark floating pill, raised round centre button (classic, usiku)
//  bar:  full-width frosted tab bar, like iOS (pwani)
//  dock: floating pill where the active tab expands into a labelled capsule (savanna)
export function FloatingNav({ items }: { items: NavItem[] }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isActive = (it: NavItem) => (it.match ? it.match.some((m) => pathname.startsWith(m)) : pathname === it.to);

  if (theme.nav === "bar") {
    return (
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <Row
          justify="space-around" align="flex-start" gap={0}
          style={[{ backgroundColor: c.navBg, borderTopWidth: 1, borderTopColor: c.navBorder, paddingTop: 8, paddingBottom: 26, paddingHorizontal: 6 }, blur(20)]}
        >
          {items.map((it) => {
            const on = isActive(it);
            if (it.center) {
              return (
                <Pressable key={it.label} onPress={() => nav(it.to)} style={{ alignItems: "center", gap: 3, minWidth: 64, cursor: "pointer" }}>
                  <View style={{ width: 44, height: 32, borderRadius: 16, backgroundColor: c.navCenterBg, alignItems: "center", justifyContent: "center" }}><Icon name={it.icon} size={22} color={c.navCenterFg} strokeWidth={2.4} /></View>
                  <T v="tiny" color={c.navIdle} weight="500" style={{ fontSize: 10 }}>{it.label}</T>
                </Pressable>
              );
            }
            return (
              <Pressable key={it.label} onPress={() => nav(it.to)} style={{ alignItems: "center", gap: 3, minWidth: 64, paddingTop: 2, cursor: "pointer" }}>
                <Icon name={it.icon} size={24} color={on ? c.navActive : c.navIdle} fill={on ? c.navActive : "none"} strokeWidth={on ? 1.6 : 1.7} />
                <T v="tiny" color={on ? c.navActive : c.navIdle} weight={on ? "600" : "500"} style={{ fontSize: 10 }}>{it.label}</T>
              </Pressable>
            );
          })}
        </Row>
      </View>
    );
  }

  const dock = theme.nav === "dock";
  return (
    <View style={{ position: "absolute", left: 14, right: 14, bottom: 18, alignItems: "center" }} pointerEvents="box-none">
      <Row
        justify="space-between"
        style={[{ backgroundColor: c.navBg, borderRadius: 40, paddingHorizontal: dock ? 10 : 18, paddingVertical: dock ? 8 : 10, width: "100%", borderWidth: 1, borderColor: c.navBorder, boxShadow: shadow.float } as object]}
        gap={0}
      >
        {items.map((it) => {
          const on = isActive(it);
          if (it.center) {
            return (
              <Pressable key={it.label} onPress={() => nav(it.to)} style={{ marginTop: -22, width: 62, height: 62, borderRadius: 31, backgroundColor: c.navCenterBg, borderWidth: 4, borderColor: c.navCenterRing, alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon name={it.icon} size={28} color={c.navCenterFg} strokeWidth={2.2} />
              </Pressable>
            );
          }
          if (dock) {
            return (
              <Pressable key={it.label} onPress={() => nav(it.to)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: on ? 14 : 10, borderRadius: 24, backgroundColor: on ? c.navCapsule : "transparent", cursor: "pointer" }}>
                <Icon name={it.icon} size={21} color={on ? c.navActive : c.navIdle} />
                {on ? <T v="small" color={c.navActive} weight="700">{it.label}</T> : null}
              </Pressable>
            );
          }
          return (
            <Pressable key={it.label} onPress={() => nav(it.to)} style={{ alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6, minWidth: 56, cursor: "pointer" }}>
              <Icon name={it.icon} size={22} color={on ? c.navActive : c.navIdle} fill={on ? c.navActive : "none"} />
              <T v="tiny" color={on ? c.navActive : c.navIdle} weight={on ? "600" : "500"}>{it.label}</T>
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
    <View style={{ backgroundColor: dark ? c.panel : c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -28, flex: 1, maxHeight, borderTopWidth: dark ? 1 : 0, borderColor: c.line }}>
      <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: dark ? c.stepLineIdlePanel : c.stepLineIdle, marginTop: 10 }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
  );
}
