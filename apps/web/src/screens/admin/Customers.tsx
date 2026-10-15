import { useState } from "react";
import { View } from "react-native";
import { Avatar, Badge, Button, Card, Divider, Muted, Row, T, money } from "../../ui/kit";
import { useStore } from "../../data/store";
import { DataTable, Page, SplitView } from "./parts";

export function AdminCustomers() {
  const { customers, patchCustomer, deliveries } = useStore();
  const [sel, setSel] = useState(customers[0]!.id);
  const c0 = customers.find((x) => x.id === sel);
  const theirs = deliveries.filter((d) => d.senderId === sel);
  return (
    <Page title="Customers" sub="Shops and individuals who request deliveries">
      <SplitView
        main={
          <DataTable
            rows={customers} selected={sel} onRow={(r) => setSel(r.id)}
            cols={[
              { title: "Customer", flex: 2, render: (r) => <Row gap={10}><Avatar name={r.business} size={34} /><View><T v="small" weight="600">{r.business}</T><Muted v="tiny">{r.name} · {r.phone}</Muted></View></Row> },
              { title: "Deliveries", width: 90, render: (r) => <T v="small">{r.deliveries}</T> },
              { title: "Spent", width: 120, render: (r) => <T v="small">{money(r.spent)}</T> },
              { title: "Rating", width: 70, render: (r) => <T v="small">★ {r.rating}</T> },
              { title: "Status", width: 100, render: (r) => <Badge tone={r.status === "active" ? "green" : "red"}>{r.status}</Badge> },
            ]}
          />
        }
        panel={
          c0 ? (
            <Card style={{ gap: 12, padding: 20 }}>
              <Row gap={14}><Avatar name={c0.business} size={56} /><View style={{ flex: 1 }}><T v="title">{c0.business}</T><Muted>{c0.name}</Muted></View></Row>
              <Row gap={8}>{c0.verified ? <Badge tone="green">Verified business</Badge> : <Badge tone="amber">Unverified</Badge>}<Badge tone={c0.status === "active" ? "green" : "red"}>{c0.status}</Badge></Row>
              <Divider />
              <Row justify="space-between"><Muted>Phone</Muted><T v="small" weight="500">{c0.phone}</T></Row>
              <Row justify="space-between"><Muted>Deliveries</Muted><T v="small" weight="500">{c0.deliveries}</T></Row>
              <Row justify="space-between"><Muted>Spent (paid to drivers)</Muted><T v="small" weight="500">{money(c0.spent)}</T></Row>
              <Row justify="space-between"><Muted>In this session</Muted><T v="small" weight="500">{theirs.length} requests</T></Row>
              <Divider />
              <Row gap={8} style={{ flexWrap: "wrap" }}>
                <Button label={c0.verified ? "Remove verified badge" : "Mark verified (TIN + licence)"} variant="light" small full={false} onPress={() => patchCustomer(c0.id, { verified: !c0.verified })} />
                <Button label={c0.status === "active" ? "Block" : "Unblock"} variant={c0.status === "active" ? "danger" : "dark"} small full={false} onPress={() => patchCustomer(c0.id, { status: c0.status === "active" ? "blocked" : "active" })} />
              </Row>
            </Card>
          ) : undefined
        }
      />
    </Page>
  );
}
