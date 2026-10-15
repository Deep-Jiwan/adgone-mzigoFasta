import { View } from "react-native";
import { Avatar, Badge, Button, Card, Muted, Row, T } from "../../ui/kit";
import { useStore } from "../../data/store";
import { Page } from "./parts";

const LABEL = { mock_location: "Fake GPS", impossible_speed: "Impossible speed", wrong_code: "Wrong delivery codes", integrity_failed: "Device integrity" } as const;

export function AdminSafety() {
  const { signals, drivers, resolveSignal, patchDriver } = useStore();
  const open = signals.filter((s) => !s.resolved);
  const closed = signals.filter((s) => s.resolved);
  const render = (list: typeof signals) => list.map((s) => {
    const dr = drivers.find((d) => d.id === s.driverId)!;
    return (
      <Card key={s.id} style={{ gap: 10 }}>
        <Row justify="space-between" align="flex-start" style={{ flexWrap: "wrap" }}>
          <Row gap={12}><Avatar name={dr.name} size={40} /><View><T v="body" weight="600">{dr.name}</T><Muted>{dr.plate} · {s.at}</Muted></View></Row>
          <Row gap={8}><Badge tone="neutral">{LABEL[s.kind]}</Badge><Badge tone={s.severity === "high" ? "red" : "amber"}>{s.severity}</Badge></Row>
        </Row>
        <T v="body">{s.detail}</T>
        {!s.resolved ? (
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            <Button label="Mark reviewed" variant="light" small full={false} onPress={() => resolveSignal(s.id)} />
            {dr.status === "approved" ? <Button label="Suspend driver" variant="danger" small full={false} icon="ban" onPress={() => { patchDriver(dr.id, { status: "suspended", online: false }); resolveSignal(s.id); }} /> : <Badge tone="red">Driver suspended</Badge>}
          </Row>
        ) : null}
      </Card>
    );
  });
  return (
    <Page title="Safety & fraud" sub="Fake GPS, impossible speeds, repeated wrong codes">
      <T v="h2">Needs review ({open.length})</T>
      {open.length ? render(open) : <Card><Muted>Nothing waiting. Nice.</Muted></Card>}
      <T v="h2">Reviewed</T>
      {render(closed)}
    </Page>
  );
}
