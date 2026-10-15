import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { c, noOutline, radius } from "../../theme";
import { TruckArt, BoxArt } from "../../ui/Art";
import { Icon } from "../../ui/Icon";
import { Card, Muted, RoundButton, Row, Screen, SectionHeader, T } from "../../ui/kit";
import { useStore } from "../../data/store";
import { ME_CUSTOMER, TERMINAL, etaMinutes } from "../../data/model";
import { CurrentShipmentCard, ShipmentRow } from "./parts";

export function CustomerHome() {
  const nav = useNavigate();
  const { deliveries, settings, customers } = useStore();
  const me = customers.find((x) => x.id === ME_CUSTOMER)!;
  const mine = deliveries.filter((d) => d.senderId === ME_CUSTOMER);
  const current = mine.find((d) => !TERMINAL.includes(d.status));
  const recent = mine.filter((d) => d !== current).slice(0, 4);
  const [q, setQ] = useState("");
  const results = q ? mine.filter((d) => (d.id + d.item).toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <Screen bottomPad={96}>
      <Row justify="space-between" style={{ paddingTop: 6 }}>
        <Row gap={12}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line }}><Icon name="truck" size={22} /></View>
          <View><Muted>Delivering for</Muted><T v="body" weight="500">{me.business}</T></View>
        </Row>
        <RoundButton icon="bell" bg={c.surface} fg={c.text} badge={3} />
      </Row>

      <Row>
        <Row style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 18, height: 56 }} gap={10}>
          <Icon name="search" size={20} color={c.muted} />
          <TextInput
            value={q} onChangeText={setQ} placeholder="Search by ID or item" placeholderTextColor={c.muted}
            style={[{ flex: 1, fontSize: 15, minWidth: 0, color: c.text }, noOutline]}
          />
        </Row>
        <RoundButton icon="scan" size={56} onPress={() => nav("/customer/track")} />
      </Row>

      {q ? (
        <View style={{ gap: 10 }}>{results.length ? results.map((d) => <ShipmentRow key={d.id} d={d} />) : <Muted>No shipment matches “{q}”.</Muted>}</View>
      ) : (
        <>
          <Row gap={12}>
            <Card onPress={() => nav("/customer/new")} style={{ flex: 1, height: 130, padding: 16, overflow: "hidden" }}>
              <T v="h2" style={{ lineHeight: 22 }}>New{"\n"}Delivery</T>
              <View style={{ position: "absolute", right: -14, bottom: -10 }}><TruckArt size={104} /></View>
            </Card>
            <Card onPress={() => nav("/customer/track")} style={{ flex: 1, height: 130, padding: 16, overflow: "hidden" }}>
              <T v="h2" style={{ lineHeight: 22 }}>Track{"\n"}Package</T>
              <View style={{ position: "absolute", right: -18, bottom: -16 }}><BoxArt size={110} /></View>
            </Card>
          </Row>

          <SectionHeader title="Current Shipment" action="See All" onAction={() => nav("/customer/shipments")} />
          {current ? (
            <CurrentShipmentCard d={current} minutesLeft={Math.max(1, Math.round(etaMinutes(settings, current.vehicle, current.km) * (1 - current.leg)))} />
          ) : (
            <Card style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
              <BoxArt size={80} />
              <T v="h2">No active deliveries</T>
              <Muted>Request one and watch the driver come to you.</Muted>
              <Pressable onPress={() => nav("/customer/new")} style={{ backgroundColor: c.selected, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12, cursor: "pointer" }}><T v="small" color={c.onSelected} weight="600">Request a delivery</T></Pressable>
            </Card>
          )}

          <SectionHeader title="Recent Shipment" action="See All" onAction={() => nav("/customer/shipments")} />
          <View style={{ gap: 10 }}>{recent.map((d) => <ShipmentRow key={d.id} d={d} />)}</View>
        </>
      )}
    </Screen>
  );
}
