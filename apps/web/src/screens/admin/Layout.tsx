import { Pressable, ScrollView, View } from "react-native";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { c } from "../../theme";
import { Icon, type IconName } from "../../ui/Icon";
import { Avatar, Badge, Muted, Row, T, useIsDesktop } from "../../ui/kit";
import { useStore } from "../../data/store";

const NAV: { to: string; label: string; icon: IconName; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: "chart", exact: true },
  { to: "/admin/deliveries", label: "Deliveries", icon: "box" },
  { to: "/admin/drivers", label: "Drivers", icon: "bike" },
  { to: "/admin/customers", label: "Customers", icon: "users" },
  { to: "/admin/wallets", label: "Wallets & cash", icon: "wallet" },
  { to: "/admin/safety", label: "Safety & fraud", icon: "shield" },
  { to: "/admin/settings", label: "Settings", icon: "sliders" },
];

export function AdminLayout() {
  const desktop = useIsDesktop();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { signals, drivers } = useStore();
  const alerts = signals.filter((s) => !s.resolved).length + drivers.filter((d) => d.status === "pending").length;
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));

  const items = NAV.map((n) => {
    const on = active(n);
    return (
      <Pressable
        key={n.to} onPress={() => nav(n.to)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: on ? c.sideActive : "transparent", cursor: "pointer" }}
      >
        <Icon name={n.icon} size={19} color={on ? c.accent : c.onSideMuted} />
        <T v="small" color={on ? c.onSide : c.onSideMuted} weight={on ? "600" : "500"}>{n.label}</T>
        {n.to === "/admin/safety" && alerts ? <View style={{ marginLeft: "auto" }}><Badge tone="accent">{alerts}</Badge></View> : null}
      </Pressable>
    );
  });

  if (!desktop) {
    return (
      <View style={{ flex: 1 }}>
        <Row justify="space-between" style={{ backgroundColor: c.side, padding: 14 }}>
          <Pressable onPress={() => nav("/")}><T v="h2" color={c.onSide} weight="600">MzigoFasta Admin</T></Pressable>
          <Avatar name="Ops Desk" size={32} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: c.side }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 10, gap: 4 }}>{items}</ScrollView>
        <View style={{ flex: 1 }}><Outlet /></View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 252, backgroundColor: c.side, padding: 18, gap: 6, borderRightWidth: 1, borderRightColor: c.line }}>
        <Pressable onPress={() => nav("/")} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, paddingBottom: 22, paddingTop: 6, cursor: "pointer" }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Icon name="truck" size={20} color={c.onAccent} /></View>
          <View><T v="h2" color={c.onSide} weight="600">MzigoFasta</T><T v="tiny" color={c.onSideMuted}>Admin · Dar es Salaam</T></View>
        </Pressable>
        {items}
        <View style={{ flex: 1 }} />
        <Row gap={10} style={{ backgroundColor: c.sideActive, borderRadius: 18, padding: 12 }}>
          <Avatar name="Ops Desk" size={36} /><View style={{ flex: 1 }}><T v="small" color={c.onSide} weight="600">Ops Desk</T><Muted v="tiny">Super admin</Muted></View>
        </Row>
      </View>
      <View style={{ flex: 1 }}><Outlet /></View>
    </View>
  );
}
