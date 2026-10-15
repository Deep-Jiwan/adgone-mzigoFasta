import { useState } from "react";
import { View } from "react-native";
import { c } from "../../theme";
import { Avatar, Badge, Button, Card, Chip, Divider, Muted, Row, T, money } from "../../ui/kit";
import { MapView } from "../../ui/MapView";
import { useStore } from "../../data/store";
import { STATUS_LABEL, STATUS_TONE, TERMINAL } from "../../data/model";
import { DataTable, Page, SplitView } from "./parts";

const FILTERS = ["All", "Waiting", "In progress", "Delivered", "Cancelled"] as const;

export function AdminDeliveries() {
  const { deliveries, drivers, customers, settings, act } = useStore();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [sel, setSel] = useState<string | undefined>(deliveries[0]?.id);
  const rows = deliveries.filter((d) =>
    f === "All" ? true : f === "Waiting" ? d.status === "OPEN" : f === "In progress" ? !TERMINAL.includes(d.status) && d.status !== "OPEN" : f === "Delivered" ? d.status === "DELIVERED" || d.status === "CLOSED" : d.status === "CANCELLED" || d.status === "EXPIRED",
  );
  const d = deliveries.find((x) => x.id === sel);
  const driver = drivers.find((x) => x.id === d?.driverId);
  const sender = customers.find((x) => x.id === d?.senderId);

  return (
    <Page title="Deliveries" sub={`${deliveries.length} total`}>
      <Row gap={8} style={{ flexWrap: "wrap" }}>{FILTERS.map((x) => <Chip key={x} label={x} active={f === x} onPress={() => setF(x)} />)}</Row>
      <SplitView
        main={
          <DataTable
            rows={rows} selected={sel} onRow={(r) => setSel(r.id)}
            cols={[
              { title: "ID", width: 96, render: (r) => <T v="small" weight="600">{r.id}</T> },
              { title: "Item", flex: 1.4, render: (r) => <T v="small" numberOfLines={1}>{r.item}</T> },
              { title: "Route", flex: 1.6, render: (r) => <T v="small" numberOfLines={1}>{r.pickup.area} → {r.dropoff.area}</T> },
              { title: "Vehicle", width: 80, render: (r) => <T v="small">{settings.vehicles[r.vehicle].label}</T> },
              { title: "Price", width: 100, render: (r) => <T v="small">{money(r.price + r.tip)}</T> },
              { title: "Status", width: 150, render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
            ]}
          />
        }
        panel={
          d ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <MapView pickup={d.pickup} dropoff={d.dropoff} phase={d.status === "PICKED_UP" ? "toDropoff" : d.status === "ACCEPTED" ? "toPickup" : "none"} leg={d.leg} height={180} seed={d.id} />
              <View style={{ padding: 18, gap: 12 }}>
                <Row justify="space-between"><T v="title">{d.id}</T><Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></Row>
                <Muted>{d.item} · {d.weightKg} kg · declared {money(d.valueTzs)}</Muted>
                <Divider />
                <Row justify="space-between"><Muted>Sender</Muted><T v="small" weight="500">{sender?.business}</T></Row>
                <Row justify="space-between"><Muted>Recipient</Muted><T v="small" weight="500">{d.recipientName}</T></Row>
                <Row justify="space-between"><Muted>Driver</Muted>{driver ? <Row gap={8}><Avatar name={driver.name} size={24} /><T v="small" weight="500">{driver.name}</T></Row> : <T v="small" color={c.muted}>Unassigned</T>}</Row>
                <Row justify="space-between"><Muted>Distance</Muted><T v="small" weight="500">{d.km} km</T></Row>
                <Row justify="space-between"><Muted>Price</Muted><T v="small" weight="500">{money(d.price)}{d.tip ? ` + ${money(d.tip)} tip` : ""}</T></Row>
                <Row justify="space-between"><Muted>Payment</Muted><T v="small" weight="500">Cash · {d.payer === "recipient" ? "recipient pays" : "sender pays"}</T></Row>
                <Row justify="space-between"><Muted>Platform fee</Muted><T v="small" weight="500">{money(d.commission)}</T></Row>
                <Divider />
                <T v="small" weight="600">Timeline</T>
                {d.timeline.map((t, i) => <Row key={i} gap={10}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === d.timeline.length - 1 ? c.accent : c.line }} /><T v="small" style={{ flex: 1 }}>{STATUS_LABEL[t.status]}</T><Muted>{t.at}</Muted></Row>)}
                <Divider />
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  <Button label="Open public link" variant="light" small full={false} icon="link" onPress={() => window.open(`/t/${d.token}`, "_blank")} />
                  {(d.status === "ACCEPTED" || d.status === "AT_PICKUP") ? <Button label="Release job" variant="light" small full={false} onPress={() => act(d.id, "release")} /> : null}
                  {(d.status === "OPEN" || d.status === "ACCEPTED" || d.status === "AT_PICKUP") ? <Button label="Cancel" variant="danger" small full={false} onPress={() => act(d.id, "cancel")} /> : null}
                </Row>
              </View>
            </Card>
          ) : undefined
        }
      />
    </Page>
  );
}
