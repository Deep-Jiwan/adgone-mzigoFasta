import { View } from "react-native";
import { Pressable } from "react-native";
import { useNavigate } from "react-router-dom";
import { c } from "../../theme";
import { Icon } from "../../ui/Icon";
import { Avatar, Badge, Card, Muted, Row, Screen, T } from "../../ui/kit";
import { useStore } from "../../data/store";
import { ME_DRIVER } from "../../data/model";

export function DriverProfile() {
  const nav = useNavigate();
  const { drivers, settings } = useStore();
  const me = drivers.find((d) => d.id === ME_DRIVER)!;
  const docs: [string, boolean][] = [["NIDA ID", me.docs.nida], ["Driving licence", me.docs.licence], ["Vehicle registration", me.docs.reg], ["Selfie", me.docs.selfie]];
  return (
    <Screen bottomPad={96}>
      <Row gap={14} style={{ paddingTop: 12 }}>
        <Avatar name={me.name} size={64} />
        <View style={{ flex: 1 }}><T v="title">{me.name}</T><Muted>{me.phone}</Muted></View>
        <Badge tone="green">Approved</Badge>
      </Row>
      <Row gap={12}>
        <Card style={{ flex: 1, alignItems: "center" }}><T v="title">{me.rating}</T><Muted>Rating</Muted></Card>
        <Card style={{ flex: 1, alignItems: "center" }}><T v="title">{me.jobs}</T><Muted>Jobs</Muted></Card>
        <Card style={{ flex: 1, alignItems: "center" }}><T v="title">Tier {me.tier}</T><Muted>Level</Muted></Card>
      </Row>
      <Card style={{ gap: 10 }}>
        <T v="h2">Vehicle</T>
        <Row justify="space-between"><Muted>Type</Muted><T v="body" weight="500">{settings.vehicles[me.vehicle].label}</T></Row>
        <Row justify="space-between"><Muted>Plate</Muted><T v="body" weight="500">{me.plate}</T></Row>
      </Card>
      <Card style={{ gap: 10 }}>
        <T v="h2">Documents</T>
        {docs.map(([k, ok]) => <Row key={k} justify="space-between"><T v="body">{k}</T><Icon name={ok ? "check" : "alert"} size={18} color={ok ? c.green : c.red} strokeWidth={2.6} /></Row>)}
      </Card>
      <Card style={{ gap: 10 }}>
        <T v="h2">Phone checks</T>
        <Row justify="space-between"><T v="body">Mock location</T><Badge tone="green">Off</Badge></Row>
        <Row justify="space-between"><T v="body">Device integrity</T><Badge tone="green">Passed</Badge></Row>
        <Muted>Fake GPS blocks pickup and delivery checkpoints.</Muted>
      </Card>
      <Pressable onPress={() => nav("/")} style={{ cursor: "pointer" }}><Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Icon name="logout" size={20} /><T v="body" weight="500">Switch role</T></Card></Pressable>
    </Screen>
  );
}
