import { View } from "react-native";
import { useNavigate } from "react-router-dom";
import { ACTIVE_STATUSES } from "@mzigo/contracts";
import { c } from "../../theme";
import { Avatar, Badge, Button, Card, Muted, Row, Screen, SectionHeader, T, Toggle, money } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { MapView } from "../../ui/MapView";
import { useStore } from "../../data/store";
import { type Delivery, ME_DRIVER, etaMinutes } from "../../data/model";

export function Jobs() {
  const nav = useNavigate();
  const { deliveries, drivers, settings, patchDriver, act } = useStore();
  const me = drivers.find((d) => d.id === ME_DRIVER)!;
  const active = deliveries.find((d) => d.driverId === me.id && ACTIVE_STATUSES.includes(d.status));
  const offers = deliveries.filter((d) => d.status === "OPEN" && d.vehicle === me.vehicle);
  const today = deliveries.filter((d) => d.driverId === me.id && (d.status === "DELIVERED" || d.status === "CLOSED") && d.createdLabel.startsWith("Today"));
  const cash = today.reduce((n, d) => n + d.price + d.tip, 0);

  const accept = (d: Delivery) => { act(d.id, "accept", me.id); nav(`/driver/job/${d.id}`); };

  return (
    <Screen bottomPad={96}>
      <Row justify="space-between" style={{ paddingTop: 6 }}>
        <Row gap={12}><Avatar name={me.name} size={46} /><View><Muted>Habari,</Muted><T v="h2" weight="600">{me.name.split(" ")[0]}</T></View></Row>
        <Row gap={6} style={{ backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}><Icon name="star" size={15} color={c.orange} fill={c.orange} /><T v="small" weight="600">{me.rating}</T></Row>
      </Row>

      <Card dark style={{ gap: 14 }}>
        <Row justify="space-between">
          <View style={{ flex: 1 }}>
            <T v="title" color="#fff">{me.online ? "You're online" : "You're offline"}</T>
            <T v="small" color="#9A9AA1">{me.online ? "Nearby jobs for your " + settings.vehicles[me.vehicle].label.toLowerCase() + " appear below." : "Go online to receive jobs."}</T>
          </View>
          <Toggle on={me.online} onChange={(v) => patchDriver(me.id, { online: v })} />
        </Row>
        <Row gap={10}>
          {[["Wallet", money(me.wallet)], ["Cash today", money(cash)], ["Jobs today", String(today.length)]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: c.sheet2, borderRadius: 16, padding: 12 }}><T v="tiny" color="#9A9AA1">{k}</T><T v="small" color="#fff" weight="600">{v}</T></View>
          ))}
        </Row>
      </Card>

      {active ? (
        <Card onPress={() => nav(`/driver/job/${active.id}`)} style={{ backgroundColor: c.orangeSoft, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="nav" size={22} color={c.orangeDeep} />
          <View style={{ flex: 1 }}><T v="body" weight="600">Job in progress · {active.id}</T><Muted>{active.pickup.area} → {active.dropoff.area}</Muted></View>
          <Icon name="chevron" size={18} color={c.orangeDeep} />
        </Card>
      ) : null}

      <SectionHeader title={`Jobs near you${me.online ? ` (${offers.length})` : ""}`} />
      {!me.online ? (
        <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}><Icon name="lock" size={26} color={c.muted} /><Muted>Go online to see jobs.</Muted></Card>
      ) : offers.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}><Icon name="search" size={26} color={c.muted} /><Muted>No jobs right now. We'll alert you.</Muted></Card>
      ) : (
        offers.map((d) => {
          const lowWallet = me.wallet < d.commission;
          return (
            <Card key={d.id} style={{ padding: 0, overflow: "hidden" }}>
              <MapView pickup={d.pickup} dropoff={d.dropoff} height={120} seed={d.id} />
              <View style={{ padding: 16, gap: 12 }}>
                <Row justify="space-between" align="flex-start">
                  <View style={{ flex: 1 }}><T v="h2" numberOfLines={1}>{d.pickup.area} → {d.dropoff.area}</T><Muted>{d.km} km · ~{etaMinutes(settings, d.vehicle, d.km)} min · {d.weightKg} kg</Muted></View>
                  <View style={{ alignItems: "flex-end" }}><T v="title" style={{ fontSize: 20 }}>{money(d.price + d.tip)}</T>{d.tip ? <Badge tone="green">+{d.tip.toLocaleString()} tip</Badge> : null}</View>
                </Row>
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  <Badge tone="neutral">{d.item}</Badge>
                  <Badge tone="orange">Cash from {d.payer === "recipient" ? "recipient" : "sender"}</Badge>
                  <Badge tone="neutral">Fee {money(d.commission)}</Badge>
                </Row>
                <Button label={lowWallet ? "Top up wallet to accept" : active ? "Finish your current job first" : "Accept job"} variant={lowWallet || active ? "light" : "orange"} disabled={lowWallet || !!active} onPress={() => accept(d)} />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
