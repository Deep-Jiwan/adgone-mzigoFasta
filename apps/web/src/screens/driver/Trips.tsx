import { View } from "react-native";
import { c } from "../../theme";
import { Badge, Card, Muted, Row, Screen, SectionHeader, T, money } from "../../ui/kit";
import { useStore } from "../../data/store";
import { ME_DRIVER, STATUS_LABEL, STATUS_TONE } from "../../data/model";

export function Trips() {
  const { deliveries } = useStore();
  const mine = deliveries.filter((d) => d.driverId === ME_DRIVER && (d.status === "DELIVERED" || d.status === "CLOSED"));
  const cash = mine.reduce((n, d) => n + d.price + d.tip, 0);
  return (
    <Screen bottomPad={96}>
      <T v="display" style={{ paddingTop: 8 }}>Trips</T>
      <Row gap={12}>
        <Card style={{ flex: 1 }}><Muted>Cash earned</Muted><T v="title">{money(cash)}</T></Card>
        <Card style={{ flex: 1 }}><Muted>Completed</Muted><T v="title">{mine.length}</T></Card>
      </Row>
      <SectionHeader title="Recent trips" />
      <View style={{ gap: 10 }}>
        {mine.map((d) => (
          <Card key={d.id} style={{ padding: 14 }}>
            <Row justify="space-between" align="flex-start">
              <View style={{ flex: 1 }}><T v="body" weight="600">{d.pickup.area} → {d.dropoff.area}</T><Muted v="tiny">{d.id} · {d.createdLabel} · {d.km} km</Muted></View>
              <View style={{ alignItems: "flex-end", gap: 4 }}><T v="h2" color={c.green}>+{money(d.price + d.tip)}</T><Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></View>
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
