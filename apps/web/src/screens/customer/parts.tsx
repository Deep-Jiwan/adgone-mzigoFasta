import { View } from "react-native";
import { useNavigate } from "react-router-dom";
import { c } from "../../theme";
import { BoxArt } from "../../ui/Art";
import { Badge, Card, DotStepper, Muted, Row, T, money } from "../../ui/kit";
import { type Delivery, STATUS_LABEL, STATUS_TONE, stepIndex } from "../../data/model";

export function ItemThumb({ item, size = 52 }: { item: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.canvas, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <BoxArt size={size * 0.8} />
      <View style={{ position: "absolute", opacity: 0 }}><T>{item}</T></View>
    </View>
  );
}

export function ShipmentRow({ d }: { d: Delivery }) {
  const nav = useNavigate();
  return (
    <Card onPress={() => nav(`/customer/track/${d.id}`)} style={{ padding: 14 }}>
      <Row gap={12}>
        <ItemThumb item={d.item} />
        <View style={{ flex: 1 }}>
          <T v="h2" numberOfLines={1}>ID: {d.id}</T>
          <Muted numberOfLines={1}>{d.item}</Muted>
          <Muted v="tiny" numberOfLines={1}>{d.pickup.area} → {d.dropoff.area} · {money(d.price + d.tip)}</Muted>
        </View>
        <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
      </Row>
    </Card>
  );
}

export function CurrentShipmentCard({ d, minutesLeft }: { d: Delivery; minutesLeft?: number }) {
  const nav = useNavigate();
  const idx = stepIndex(d.status);
  return (
    <Card onPress={() => nav(`/customer/track/${d.id}`)} style={{ overflow: "hidden", padding: 18 }}>
      <Row justify="space-between" align="flex-start">
        <Row gap={12} style={{ flex: 1 }}>
          <ItemThumb item={d.item} size={56} />
          <View style={{ flex: 1 }}>
            <T v="title" style={{ fontSize: 20 }}>ID: {d.id}</T>
            <Muted numberOfLines={1}>{d.item}</Muted>
          </View>
        </Row>
        <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
      </Row>
      <View style={{ marginTop: 18, paddingRight: 70 }}>
        {minutesLeft !== undefined && idx >= 2 && idx < 5 ? (
          <View style={{ alignItems: "center", marginBottom: 4, marginLeft: `${Math.min(70, (idx - 1) * 25)}%` as never }}>
            <Muted v="tiny">{minutesLeft} min away</Muted>
          </View>
        ) : null}
        <DotStepper steps={5} done={Math.max(0, idx - 1)} truckAt={idx < 5 ? idx - 1 : undefined} />
        <Row justify="space-between" align="flex-start" style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}><Muted v="tiny">{d.createdLabel}</Muted><T v="body" weight="500" numberOfLines={1}>{d.pickup.area}</T></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}><Muted v="tiny">Estimated</Muted><T v="body" weight="500" numberOfLines={1}>{d.dropoff.area}</T></View>
        </Row>
      </View>
      <View style={{ position: "absolute", right: -18, bottom: 6 }}><BoxArt size={104} /></View>
    </Card>
  );
}
