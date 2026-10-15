import { useState } from "react";
import { View } from "react-native";
import { ACTIVE_STATUSES } from "@mzigo/contracts";
import { c } from "../../theme";
import { Badge, Button, Card, Chip, Field, Muted, Row, T, money } from "../../ui/kit";
import { useStore } from "../../data/store";
import { DataTable, Page, SplitView, Stat } from "./parts";

const KIND = { deposit: "green", commission: "neutral", hold: "amber", adjustment: "blue" } as const;

export function AdminWallets() {
  const { drivers, ledger, deposit, deliveries } = useStore();
  const [driverId, setDriverId] = useState(drivers[0]!.id);
  const [amount, setAmount] = useState("20000");
  const [ref, setRef] = useState("");
  const [done, setDone] = useState("");
  const float = drivers.reduce((n, d) => n + d.wallet, 0);
  const fees = ledger.filter((l) => l.kind === "commission").reduce((n, l) => n - l.amount, 0);
  const holds = deliveries.filter((d) => d.driverId && ACTIVE_STATUSES.includes(d.status)).reduce((n, d) => n + d.commission, 0);
  const approved = drivers.filter((d) => d.status === "approved");

  return (
    <Page title="Wallets & cash" sub="Drivers keep the customer cash. Their wallet only pays the platform fee.">
      <Row gap={14} style={{ flexWrap: "wrap" }}>
        <Stat label="Driver wallet float" value={money(float)} sub="owed back on request" />
        <Stat label="Platform fees collected" value={money(fees)} sub="charged on delivery" tone="accent" />
        <Stat label="Held for open jobs" value={money(holds)} sub="released if cancelled" tone="amber" />
      </Row>
      <SplitView
        main={
          <DataTable
            rows={ledger}
            cols={[
              { title: "When", width: 130, render: (l) => <Muted>{l.at}</Muted> },
              { title: "Driver", flex: 1.4, render: (l) => <T v="small" weight="500">{drivers.find((d) => d.id === l.driverId)?.name}</T> },
              { title: "Type", width: 110, render: (l) => <Badge tone={KIND[l.kind]}>{l.kind}</Badge> },
              { title: "Reference", flex: 1, render: (l) => <Muted>{l.ref}</Muted> },
              { title: "Amount", width: 110, align: "flex-end", render: (l) => <T v="small" weight="600" color={l.amount >= 0 ? c.green : c.text}>{l.amount >= 0 ? "+" : "−"}{money(Math.abs(l.amount))}</T> },
            ]}
          />
        }
        panel={
          <Card style={{ gap: 14, padding: 20 }}>
            <T v="h2">Record a cash top-up</T>
            <Muted>Driver paid cash at an agent or the office. Mobile-money collection comes later.</Muted>
            <Row gap={8} style={{ flexWrap: "wrap" }}>{approved.map((d) => <Chip key={d.id} label={d.name.split(" ")[0]!} active={driverId === d.id} onPress={() => setDriverId(d.id)} />)}</Row>
            <Field label="Amount (TZS)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <Field label="Receipt / reference" value={ref} onChangeText={setRef} placeholder="OPS-CASH-0934" />
            <Button label="Credit wallet" variant="accent" disabled={!Number(amount)} onPress={() => { deposit(driverId, Number(amount), ref); setDone(`Credited ${money(Number(amount))}`); setRef(""); }} />
            {done ? <View><Badge tone="green">{done}</Badge></View> : null}
          </Card>
        }
      />
    </Page>
  );
}
