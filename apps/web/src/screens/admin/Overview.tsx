import { View } from "react-native";
import { useNavigate } from "react-router-dom";
import { ACTIVE_STATUSES } from "@mzigo/contracts";
import { c } from "../../theme";
import { Avatar, Badge, Button, Card, Muted, Row, SectionHeader, T, money, useIsDesktop } from "../../ui/kit";
import { MapView } from "../../ui/MapView";
import { useStore } from "../../data/store";
import { STATUS_LABEL, STATUS_TONE } from "../../data/model";
import { DataTable, Page, SplitView, Stat } from "./parts";

export function Overview() {
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { deliveries, drivers, signals, patchDriver, resolveSignal, ledger } = useStore();
  const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const open = deliveries.filter((d) => d.status === "OPEN");
  const online = drivers.filter((d) => d.online && d.status === "approved");
  const today = deliveries.filter((d) => d.createdLabel.startsWith("Today"));
  const delivered = today.filter((d) => d.status === "DELIVERED" || d.status === "CLOSED");
  const gmv = delivered.reduce((n, d) => n + d.price + d.tip, 0);
  const fees = ledger.filter((l) => l.kind === "commission" && l.at.startsWith("Today")).reduce((n, l) => n - l.amount, 0);
  const pending = drivers.filter((d) => d.status === "pending");
  const alerts = signals.filter((s) => !s.resolved);

  const markers = [
    ...online.map((d) => ({ lat: d.lat, lng: d.lng, tone: "dark" as const, id: d.id })),
    ...open.map((d) => ({ lat: d.pickup.lat, lng: d.pickup.lng, tone: "orange" as const, id: d.id })),
    ...active.flatMap((d) => (d.driverId ? [] : [])),
  ];

  return (
    <Page title="Overview" sub="Live view of Dar es Salaam · operating 24/7" actions={<Button label="Open settings" variant="light" small full={false} icon="sliders" onPress={() => nav("/admin/settings")} />}>
      <Row gap={14} align="stretch" style={{ flexWrap: "wrap" }}>
        <Stat label="Active deliveries" value={String(active.length)} sub={`${open.length} waiting for a driver`} tone={open.length ? "amber" : "green"} />
        <Stat label="Drivers online" value={String(online.length)} sub={`${drivers.filter((d) => d.status === "approved").length} approved`} />
        <Stat label="Delivered today" value={String(delivered.length)} sub={`${today.length} requested`} tone="green" />
        <Stat label="Cash moved today" value={money(gmv)} sub="paid driver-direct" />
        <Stat label="Platform fees today" value={money(fees)} sub="from driver wallets" tone="orange" />
      </Row>

      <SplitView
        main={
          <View style={{ gap: 20 }}>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <MapView markers={markers} height={desktop ? 340 : 240} seed="admin" />
              <Row gap={16} style={{ padding: 14, flexWrap: "wrap" }}>
                <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.ink }} /><Muted>Online drivers</Muted></Row>
                <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.orange }} /><Muted>Jobs waiting</Muted></Row>
              </Row>
            </Card>
            <SectionHeader title="Latest deliveries" action="See all" onAction={() => nav("/admin/deliveries")} />
            <DataTable
              rows={deliveries.slice(0, 6)}
              onRow={() => nav("/admin/deliveries")}
              cols={[
                { title: "ID", width: 100, render: (d) => <T v="small" weight="600">{d.id}</T> },
                { title: "Route", flex: 2, render: (d) => <T v="small" numberOfLines={1}>{d.pickup.area} → {d.dropoff.area}</T> },
                { title: "Price", width: 110, render: (d) => <T v="small">{money(d.price + d.tip)}</T> },
                { title: "Status", width: 150, render: (d) => <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge> },
              ]}
            />
          </View>
        }
        panel={
          <View style={{ gap: 20 }}>
            <Card style={{ gap: 12 }}>
              <Row justify="space-between"><T v="h2">Driver approvals</T><Badge tone={pending.length ? "amber" : "green"}>{pending.length} pending</Badge></Row>
              {pending.length === 0 ? <Muted>All caught up.</Muted> : null}
              {pending.map((d) => (
                <Row key={d.id} gap={12}>
                  <Avatar name={d.name} size={40} /><View style={{ flex: 1 }}><T v="small" weight="600">{d.name}</T><Muted v="tiny">{d.vehicle} · {d.plate} · registration card missing</Muted></View>
                  <Button label="Approve" small full={false} onPress={() => patchDriver(d.id, { status: "approved" })} />
                </Row>
              ))}
            </Card>
            <Card style={{ gap: 12 }}>
              <Row justify="space-between"><T v="h2">Safety alerts</T><Badge tone={alerts.length ? "red" : "green"}>{alerts.length} open</Badge></Row>
              {alerts.slice(0, 4).map((s) => {
                const dr = drivers.find((d) => d.id === s.driverId);
                return (
                  <View key={s.id} style={{ gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
                    <Row justify="space-between"><T v="small" weight="600">{dr?.name}</T><Badge tone={s.severity === "high" ? "red" : "amber"}>{s.severity}</Badge></Row>
                    <Muted>{s.detail}</Muted>
                    <Row gap={8}><Button label="Dismiss" variant="light" small full={false} onPress={() => resolveSignal(s.id)} /><Button label="Review" variant="ghost" small full={false} onPress={() => nav("/admin/safety")} /></Row>
                  </View>
                );
              })}
              {alerts.length === 0 ? <Muted>No open alerts.</Muted> : null}
            </Card>
          </View>
        }
      />
    </Page>
  );
}
