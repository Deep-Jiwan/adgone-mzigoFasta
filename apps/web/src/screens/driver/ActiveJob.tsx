import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import { ACTIVE_STATUSES } from "@mzigo/contracts";
import { c } from "../../theme";
import { Badge, Button, Card, Divider, Field, Muted, RoundButton, Row, T, money } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { MapView } from "../../ui/MapView";
import { Sheet } from "../../ui/Shell";
import { useStore } from "../../data/store";
import { ME_DRIVER, STATUS_LABEL, STATUS_TONE, etaMinutes } from "../../data/model";

export function ActiveJob() {
  const { id } = useParams();
  const nav = useNavigate();
  const { deliveries, settings, act } = useStore();
  const d = id ? deliveries.find((x) => x.id === id) : deliveries.find((x) => x.driverId === ME_DRIVER && ACTIVE_STATUSES.includes(x.status));
  const [code, setCode] = useState("");
  const [tries, setTries] = useState(0);
  const [err, setErr] = useState("");
  const [cashOk, setCashOk] = useState(false);
  const [codeOk, setCodeOk] = useState(false);

  if (!d) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: c.paper }}>
        <Icon name="nav" size={36} color={c.muted} /><T v="title">No job in progress</T><Muted>Accept a job and it opens here.</Muted>
        <Button label="See jobs" full={false} onPress={() => nav("/driver")} />
      </View>
    );
  }

  const done = d.status === "DELIVERED" || d.status === "CLOSED";
  const target = d.status === "ACCEPTED" || d.status === "AT_PICKUP" ? d.pickup : d.dropoff;
  const phase = d.status === "ACCEPTED" ? "toPickup" : d.status === "PICKED_UP" ? "toDropoff" : "none";
  const total = etaMinutes(settings, d.vehicle, d.km);
  const left = Math.max(1, Math.round(total * (1 - d.leg)));
  const nav2 = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`);

  const checkCode = () => {
    if (tries >= 5) return setErr("Too many attempts. Support has been notified.");
    if (code === d.code) { setCodeOk(true); setErr(""); } else { setTries(tries + 1); setErr(`Wrong code (${5 - tries - 1} attempts left)`); }
  };
  const mustCollect = d.payer === "recipient";

  const step = {
    ACCEPTED: { title: "Head to pickup", sub: `${d.pickup.name}, ${d.pickup.area}`, icon: "pin" as const },
    AT_PICKUP: { title: "Scan the shop's QR", sub: "Proof that you have the goods. Check the parcel matches.", icon: "qr" as const },
    PICKED_UP: { title: "Head to drop-off", sub: `${d.dropoff.name}, ${d.dropoff.area}`, icon: "pin" as const },
    AT_DROPOFF: { title: "Hand over the parcel", sub: `Ask ${d.recipientName} for the 4-digit code.`, icon: "lock" as const },
    RETURNING: { title: "Return to shop", sub: "Recipient unreachable. Take the goods back to the sender.", icon: "back" as const },
  }[d.status as "ACCEPTED" | "AT_PICKUP" | "PICKED_UP" | "AT_DROPOFF" | "RETURNING"];

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View>
        <MapView pickup={d.pickup} dropoff={d.dropoff} phase={phase} leg={d.leg} height={300} seed={d.id} />
        <Row justify="space-between" style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
          <RoundButton icon="back" bg="#fff" fg={c.ink} size={44} onPress={() => nav("/driver")} />
          <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
          <RoundButton icon="nav" bg={c.ink} fg="#fff" size={44} onPress={nav2} />
        </Row>
      </View>

      <Sheet dark={false}>
        {done ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.greenSoft, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={34} color={c.green} strokeWidth={3} /></View>
            <T v="display">Delivered</T>
            <Muted>{d.id} · {d.dropoff.name}</Muted>
            <Card style={{ alignSelf: "stretch", gap: 8, backgroundColor: c.canvas }}>
              <Row justify="space-between"><Muted>Cash you keep</Muted><T v="h2">{money(d.price + d.tip)}</T></Row>
              <Row justify="space-between"><Muted>Platform fee (from wallet)</Muted><T v="small">−{money(d.commission)}</T></Row>
            </Card>
            <Button label="Back to jobs" onPress={() => nav("/driver")} />
          </View>
        ) : d.status === "RETURNED" || d.status === "CANCELLED" ? (
          <View style={{ gap: 12 }}><T v="title">Job {d.status.toLowerCase()}</T><Button label="Back to jobs" onPress={() => nav("/driver")} /></View>
        ) : step ? (
          <>
            <Row gap={14}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}><Icon name={step.icon} size={24} color="#fff" /></View>
              <View style={{ flex: 1 }}><T v="title">{step.title}</T><Muted>{step.sub}</Muted></View>
            </Row>
            <Row gap={8} style={{ flexWrap: "wrap" }}>
              <Badge tone="neutral">{d.km} km</Badge><Badge tone="neutral">{left} min</Badge><Badge tone="orange">{money(d.price + d.tip)} cash</Badge>
              <Badge tone="neutral">{d.item}</Badge>
            </Row>

            {d.status === "ACCEPTED" ? (
              <>
                <Button label="I've arrived at pickup" icon="pin" variant="orange" onPress={() => act(d.id, "arrive_pickup")} />
                <Button label="Give job back" variant="danger" onPress={() => { act(d.id, "release"); nav("/driver"); }} />
              </>
            ) : null}

            {d.status === "AT_PICKUP" ? (
              <>
                <Pressable onPress={() => act(d.id, "pickup")} style={{ height: 150, borderRadius: 24, backgroundColor: c.ink, alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer" }}>
                  <Icon name="scan" size={44} color="#fff" /><T v="body" color="#fff" weight="600">Tap to scan the shop's QR</T><T v="small" color="#9A9AA1">Camera opens in the real app</T>
                </Pressable>
                <Row gap={8}><Icon name="camera" size={18} color={c.slate} /><Muted>You'll also take a photo of the parcel.</Muted></Row>
              </>
            ) : null}

            {d.status === "PICKED_UP" ? <Button label="I've arrived at drop-off" icon="pin" variant="orange" onPress={() => act(d.id, "arrive_dropoff")} /> : null}

            {d.status === "AT_DROPOFF" ? (
              <>
                <Field label="Recipient's 4-digit code" value={code} onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 4)); setErr(""); }} keyboardType="numeric" placeholder="• • • •" icon="lock" />
                {err ? <T v="small" color={c.red}>{err}</T> : codeOk ? <Row gap={6}><Icon name="check" size={16} color={c.green} strokeWidth={3} /><T v="small" color={c.green}>Code accepted</T></Row> : <Muted>Demo code: {d.code}</Muted>}
                {!codeOk ? <Button label="Check code" variant="dark" disabled={code.length < 4} onPress={checkCode} /> : null}
                {codeOk && mustCollect ? (
                  <Pressable onPress={() => setCashOk(!cashOk)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: cashOk ? c.greenSoft : c.orangeSoft, cursor: "pointer" }}>
                    <Icon name={cashOk ? "check" : "cash"} size={22} color={cashOk ? c.green : c.orangeDeep} strokeWidth={cashOk ? 3 : 1.8} />
                    <View style={{ flex: 1 }}><T v="body" weight="600">Collect {money(d.price + d.tip)} cash</T><Muted>from {d.recipientName}. Tap when you've got it.</Muted></View>
                  </Pressable>
                ) : null}
                <Button label="Complete delivery" variant="orange" icon="check" disabled={!codeOk || (mustCollect && !cashOk)} onPress={() => act(d.id, "deliver")} />
                <Divider />
                <Button label="Recipient unreachable or refused" variant="danger" onPress={() => act(d.id, "fail")} />
              </>
            ) : null}

            {d.status === "RETURNING" ? <Button label="Shop confirmed return" onPress={() => act(d.id, "confirm_return")} /> : null}

            <Divider />
            <Row gap={12}>
              <View style={{ flex: 1 }}><Muted v="tiny">{d.status === "ACCEPTED" || d.status === "AT_PICKUP" ? "Sender" : "Recipient"}</Muted><T v="body" weight="500">{d.status === "ACCEPTED" || d.status === "AT_PICKUP" ? "Neema · Mushi Electronics" : d.recipientName}</T></View>
              <RoundButton icon="phone" bg={c.orange} />
              <RoundButton icon="chat" bg={c.ink} />
            </Row>
            {d.status !== "AT_DROPOFF" ? (
              <Muted>{mustCollect ? "You collect the cash from the recipient at drop-off." : d.status === "ACCEPTED" || d.status === "AT_PICKUP" ? "The sender pays you in cash at pickup." : "The sender already paid you in cash at pickup."}</Muted>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
