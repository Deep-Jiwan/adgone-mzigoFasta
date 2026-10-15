import { useState } from "react";
import { View } from "react-native";
import { c } from "../../theme";
import { Avatar, Badge, Button, Card, Chip, Divider, Muted, Row, T, type Tone, money } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { useStore } from "../../data/store";
import { type DriverStatus } from "../../data/model";
import { DataTable, Page, SplitView } from "./parts";

const TONE: Record<DriverStatus, Tone> = { approved: "green", pending: "amber", suspended: "red" };
const FILTERS = ["All", "pending", "approved", "suspended"] as const;

export function AdminDrivers() {
  const { drivers, settings, patchDriver, deposit } = useStore();
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [sel, setSel] = useState<string>(drivers[0]!.id);
  const rows = drivers.filter((d) => f === "All" || d.status === f);
  const d = drivers.find((x) => x.id === sel);
  const docs: [string, boolean][] = d ? [["NIDA ID", d.docs.nida], ["Driving licence", d.docs.licence], ["Vehicle registration", d.docs.reg], ["Selfie", d.docs.selfie]] : [];

  return (
    <Page title="Drivers" sub="Independent drivers who signed up themselves">
      <Row gap={8} style={{ flexWrap: "wrap" }}>{FILTERS.map((x) => <Chip key={x} label={x === "All" ? "All" : x[0]!.toUpperCase() + x.slice(1)} active={f === x} onPress={() => setF(x)} />)}</Row>
      <SplitView
        main={
          <DataTable
            rows={rows} selected={sel} onRow={(r) => setSel(r.id)}
            cols={[
              { title: "Driver", flex: 1.8, render: (r) => <Row gap={10}><Avatar name={r.name} size={34} /><View><T v="small" weight="600">{r.name}</T><Muted v="tiny">{r.phone}</Muted></View></Row> },
              { title: "Vehicle", flex: 1.2, render: (r) => <View><T v="small">{settings.vehicles[r.vehicle].label}</T><Muted v="tiny">{r.plate}</Muted></View> },
              { title: "Rating", width: 70, render: (r) => <T v="small">{r.rating ? `★ ${r.rating}` : "—"}</T> },
              { title: "Jobs", width: 60, render: (r) => <T v="small">{r.jobs}</T> },
              { title: "Wallet", width: 100, render: (r) => <T v="small">{money(r.wallet)}</T> },
              { title: "Status", width: 110, render: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
            ]}
          />
        }
        panel={
          d ? (
            <Card style={{ gap: 12, padding: 20 }}>
              <Row gap={14}><Avatar name={d.name} size={56} /><View style={{ flex: 1 }}><T v="title">{d.name}</T><Muted>Joined {d.joined} · Tier {d.tier}</Muted></View><Badge tone={TONE[d.status]}>{d.status}</Badge></Row>
              <Row justify="space-between"><Muted>Phone</Muted><T v="small" weight="500">{d.phone}</T></Row>
              <Row justify="space-between"><Muted>Vehicle</Muted><T v="small" weight="500">{settings.vehicles[d.vehicle].label} · {d.plate}</T></Row>
              <Row justify="space-between"><Muted>Online</Muted><T v="small" weight="500">{d.online ? "Yes" : "No"}</T></Row>
              <Row justify="space-between"><Muted>Wallet</Muted><T v="small" weight="500">{money(d.wallet)}</T></Row>
              <Divider />
              <T v="small" weight="600">Documents</T>
              {docs.map(([k, ok]) => <Row key={k} justify="space-between"><T v="small">{k}</T><Icon name={ok ? "check" : "alert"} size={17} color={ok ? c.green : c.red} strokeWidth={2.6} /></Row>)}
              <Divider />
              <Row gap={8} style={{ flexWrap: "wrap" }}>
                {d.status !== "approved" ? <Button label="Approve" small full={false} disabled={!Object.values(d.docs).every(Boolean) && d.status === "pending"} onPress={() => patchDriver(d.id, { status: "approved" })} /> : null}
                {d.status === "approved" ? <Button label="Suspend" variant="danger" small full={false} icon="ban" onPress={() => patchDriver(d.id, { status: "suspended", online: false })} /> : null}
                <Button label="+ TZS 10,000 credit" variant="light" small full={false} onPress={() => deposit(d.id, 10000, "Launch credit")} />
              </Row>
              {d.status === "pending" && !Object.values(d.docs).every(Boolean) ? <Muted>Approval needs all four documents.</Muted> : null}
            </Card>
          ) : undefined
        }
      />
    </Page>
  );
}
