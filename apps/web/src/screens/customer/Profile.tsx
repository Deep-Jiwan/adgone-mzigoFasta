import { useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { c } from "../../theme";
import { Icon, type IconName } from "../../ui/Icon";
import { Avatar, Badge, Card, Divider, Muted, Row, Screen, Segmented, T, Toggle } from "../../ui/kit";
import { useStore } from "../../data/store";
import { ME_CUSTOMER, PLACES } from "../../data/model";

function Item({ icon, title, sub, right }: { icon: IconName; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <Row gap={12} style={{ paddingVertical: 4 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.canvas, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} /></View>
      <View style={{ flex: 1 }}><T v="body" weight="500">{title}</T>{sub ? <Muted>{sub}</Muted> : null}</View>
      {right ?? <Icon name="chevron" size={18} color={c.muted} />}
    </Row>
  );
}

export function CustomerProfile() {
  const nav = useNavigate();
  const { customers, settings } = useStore();
  const me = customers.find((x) => x.id === ME_CUSTOMER)!;
  const [lang, setLang] = useState<"en" | "sw">("en");
  const [sms, setSms] = useState(true);
  return (
    <Screen bottomPad={96}>
      <Row gap={14} style={{ paddingTop: 12 }}>
        <Avatar name={me.name} size={64} />
        <View style={{ flex: 1 }}><T v="title">{me.name}</T><Muted>{me.business} · {me.phone}</Muted></View>
        {me.verified ? <Badge tone="green">Verified</Badge> : null}
      </Row>
      <Row gap={12}>
        <Card style={{ flex: 1, alignItems: "center" }}><T v="title">{me.deliveries}</T><Muted>Deliveries</Muted></Card>
        <Card style={{ flex: 1, alignItems: "center" }}><T v="title">{me.rating}</T><Muted>Rating</Muted></Card>
      </Row>
      <Card style={{ gap: 6 }}>
        <T v="h2">Saved locations</T>
        <Item icon="pin" title="Mushi Electronics (shop)" sub={`${PLACES[0]!.name}, ${PLACES[0]!.area}`} />
        <Item icon="pin" title="Warehouse" sub={`${PLACES[9]!.name}, ${PLACES[9]!.area}`} />
      </Card>
      <Card style={{ gap: 6 }}>
        <T v="h2">Payment</T>
        <Item icon="cash" title="Cash" sub="Paid to the driver at pickup or by the recipient on delivery" right={<Badge tone="green">Default</Badge>} />
        <Item icon="wallet" title="Mobile money" sub="Coming soon" right={<Badge>{settings.payments.mobileMoney ? "On" : "Soon"}</Badge>} />
      </Card>
      <Card style={{ gap: 10 }}>
        <T v="h2">Preferences</T>
        <Segmented value={lang} onChange={setLang} options={[{ key: "en", label: "English" }, { key: "sw", label: "Kiswahili" }]} />
        <Divider />
        <Row justify="space-between"><View style={{ flex: 1 }}><T v="body" weight="500">SMS updates</T><Muted>Driver assigned, arriving, delivered</Muted></View><Toggle on={sms} onChange={setSms} /></Row>
      </Card>
      <Card style={{ gap: 6 }}>
        <Item icon="chat" title="Support on WhatsApp" sub="Damaged or missing goods, billing" />
        <Pressable onPress={() => nav("/")} style={{ cursor: "pointer" }}><Item icon="logout" title="Switch role" sub="Back to the prototype menu" /></Pressable>
      </Card>
    </Screen>
  );
}
