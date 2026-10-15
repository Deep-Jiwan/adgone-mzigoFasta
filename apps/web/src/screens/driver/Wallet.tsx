import { View } from "react-native";
import { c } from "../../theme";
import { Badge, Button, Card, Muted, Row, Screen, SectionHeader, T, money } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { useStore } from "../../data/store";
import { ME_DRIVER } from "../../data/model";

const KIND = { deposit: { label: "Top-up", tone: "green" }, commission: { label: "Platform fee", tone: "neutral" }, hold: { label: "Held for job", tone: "amber" }, adjustment: { label: "Adjustment", tone: "blue" } } as const;

export function Wallet() {
  const { drivers, ledger, settings } = useStore();
  const me = drivers.find((d) => d.id === ME_DRIVER)!;
  const mine = ledger.filter((l) => l.driverId === me.id);
  return (
    <Screen bottomPad={96}>
      <T v="display" style={{ paddingTop: 8 }}>Wallet</T>
      <Card dark style={{ gap: 14, padding: 22 }}>
        <T v="small" color="#9A9AA1">Platform wallet</T>
        <T v="display" color="#fff" style={{ fontSize: 38 }}>{money(me.wallet)}</T>
        <T v="small" color="#9A9AA1">Covers MzigoFasta's fee ({settings.commission.mode === "fixed" ? money(settings.commission.fixed) : `${settings.commission.percent}%`}{settings.commission.mode === "both" ? ` + ${money(settings.commission.fixed)}` : ""} per job). It's held when you accept and charged when you deliver.</T>
        <Button label="Top up — mobile money soon" variant="light" disabled icon="plus" />
        <T v="tiny" color="#9A9AA1">For now, top up with cash at a MzigoFasta agent or the Kariakoo office. Ops credits your wallet within minutes.</T>
      </Card>
      <Card style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: c.accentSoft }}>
        <Icon name="cash" size={22} color={c.accentDeep} />
        <View style={{ flex: 1 }}><T v="body" weight="600">Customers pay you directly</T><Muted>Cash from senders or recipients is yours. It never goes through this wallet.</Muted></View>
      </Card>
      <SectionHeader title="Activity" />
      <View style={{ gap: 10 }}>
        {mine.map((l) => (
          <Card key={l.id} style={{ padding: 14 }}>
            <Row justify="space-between">
              <View style={{ gap: 4 }}><Badge tone={KIND[l.kind].tone}>{KIND[l.kind].label}</Badge><Muted v="tiny">{l.ref} · {l.at}</Muted></View>
              <T v="h2" color={l.amount >= 0 ? c.green : c.text}>{l.amount >= 0 ? "+" : "−"}{money(Math.abs(l.amount))}</T>
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
