import { Navigate, useNavigate, useParams } from "react-router-dom";
import { View } from "react-native";
import { c } from "../../theme";
import { Button, Avatar, Badge, Divider, DotStepper, Muted, RoundButton, Row, T, money, useToast } from "../../ui/kit";
import { MapView } from "../../ui/MapView";
import { Sheet } from "../../ui/Shell";
import { Icon } from "../../ui/Icon";
import { useStore } from "../../data/store";
import { ME_CUSTOMER, STATUS_LABEL, STATUS_TONE, TERMINAL, etaMinutes, stepIndex } from "../../data/model";

export function TrackDelivery() {
  const { id } = useParams();
  const nav = useNavigate();
  const { deliveries, drivers, settings, act } = useStore();
  const toast = useToast();
  const mine = deliveries.filter((d) => d.senderId === ME_CUSTOMER);
  const d = id ? deliveries.find((x) => x.id === id) : mine.find((x) => !TERMINAL.includes(x.status)) ?? mine[0];
  if (!d) return <Navigate to="/customer/shipments" replace />;

  const driver = drivers.find((x) => x.id === d.driverId);
  const idx = stepIndex(d.status);
  const phase = d.status === "ACCEPTED" ? "toPickup" : d.status === "PICKED_UP" ? "toDropoff" : "none";
  const total = etaMinutes(settings, d.vehicle, d.km);
  const left = d.status === "PICKED_UP" ? Math.max(1, Math.round(total * (1 - d.leg))) : d.status === "ACCEPTED" ? Math.max(1, Math.round(4 + 6 * (1 - d.leg))) : 0;
  const cancellable = d.status === "OPEN" || d.status === "ACCEPTED" || d.status === "AT_PICKUP";
  const link = `${window.location.origin}/t/${d.token}`;
  const copy = () => { void navigator.clipboard?.writeText(link); toast.show("Tracking link copied"); };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View>
        <MapView pickup={d.pickup} dropoff={d.dropoff} phase={phase} leg={d.leg} height={340} seed={d.id} />
        <Row justify="space-between" style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
          <RoundButton icon="back" bg="#fff" fg={c.ink} size={44} onPress={() => nav(-1)} />
          <View style={{ backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 }}><T v="h2">Location Tracking</T></View>
          <RoundButton icon="share" bg="#fff" fg={c.ink} size={44} onPress={copy} />
        </Row>
        {phase !== "none" ? (
          <View style={{ position: "absolute", right: 16, bottom: 44, backgroundColor: c.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
            <T v="small" color="#fff" weight="600">{left} min away</T>
          </View>
        ) : null}
      </View>
      {toast.node}

      <Sheet>
        <Row justify="space-between" align="flex-start">
          <View><T v="small" color="#9A9AA1">Booking Id</T><T v="display" color="#fff" style={{ fontSize: 28 }}>{d.id}</T></View>
          <View style={{ alignItems: "flex-end", gap: 6 }}><T v="small" color="#9A9AA1">Status</T><Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge></View>
        </Row>
        <DotStepper steps={5} done={Math.max(0, idx - 1)} truckAt={idx < 5 ? idx - 1 : undefined} dark />
        <Row justify="space-between">
          <View><T v="small" color="#9A9AA1">Created, {d.createdLabel}</T><T v="body" color="#fff" weight="500">{d.pickup.area}</T></View>
          <View style={{ alignItems: "flex-end" }}><T v="small" color="#9A9AA1">{d.status === "DELIVERED" || d.status === "CLOSED" ? "Delivered" : `ETA ${left || total} min`}</T><T v="body" color="#fff" weight="500">{d.dropoff.area}</T></View>
        </Row>
        <Divider dark />

        {d.status === "OPEN" ? (
          <View style={{ backgroundColor: c.sheet2, borderRadius: 20, padding: 16, gap: 6 }}>
            <Row gap={10}><Icon name="search" size={18} color={c.orange} /><T v="body" color="#fff" weight="600">Finding a {settings.vehicles[d.vehicle].label.toLowerCase()} driver nearby…</T></Row>
            <T v="small" color="#9A9AA1">Offers go to the nearest drivers first. Open the Driver view to accept this job.</T>
          </View>
        ) : driver ? (
          <Row gap={12} style={{ backgroundColor: c.sheet2, borderRadius: 24, padding: 12 }}>
            <Avatar name={driver.name} size={48} ring />
            <View style={{ flex: 1 }}><T v="body" color="#fff" weight="600">{driver.name}</T><T v="small" color="#9A9AA1">Courier · {settings.vehicles[driver.vehicle].label} · {driver.plate}</T></View>
            <RoundButton icon="phone" bg={c.orange} fg="#fff" />
            <RoundButton icon="chat" bg="#fff" fg={c.ink} onPress={() => nav(`/customer/chat/${d.id}`)} />
          </Row>
        ) : null}

        <Row gap={12} align="flex-start">
          <View style={{ flex: 1, gap: 14 }}>
            <View><T v="small" color="#9A9AA1">From</T><T v="body" color="#fff" weight="500">{d.pickup.name}</T></View>
            <View><T v="small" color="#9A9AA1">Recipient</T><T v="body" color="#fff" weight="500">{d.recipientName}</T></View>
            <View><T v="small" color="#9A9AA1">Item</T><T v="body" color="#fff" weight="500">{d.item}</T></View>
          </View>
          <View style={{ flex: 1, gap: 14 }}>
            <View><T v="small" color="#9A9AA1">To</T><T v="body" color="#fff" weight="500">{d.dropoff.name}</T></View>
            <View><T v="small" color="#9A9AA1">{d.payer === "recipient" ? "Recipient pays driver (cash)" : "You pay driver (cash)"}</T><T v="body" color="#fff" weight="500">{money(d.price + d.tip)}</T></View>
            <View><T v="small" color="#9A9AA1">Weight</T><T v="body" color="#fff" weight="500">{d.weightKg} kg · {settings.vehicles[d.vehicle].label}</T></View>
          </View>
        </Row>

        {d.status !== "OPEN" && !TERMINAL.includes(d.status) ? (
          <View style={{ backgroundColor: c.sheet2, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ flex: 1 }}><T v="small" color="#9A9AA1">Delivery code (sent to {d.recipientName} by SMS)</T><T v="small" color="#9A9AA1">The driver asks for it at the door.</T></View>
            <T v="display" color={c.orange} style={{ letterSpacing: 6 }}>{d.code}</T>
          </View>
        ) : null}

        <Button label="Copy tracking link" icon="link" variant="light" onPress={copy} />
        {cancellable ? <Button label={d.status === "OPEN" ? "Cancel request" : "Cancel delivery"} variant="danger" onPress={() => { act(d.id, "cancel"); toast.show("Delivery cancelled"); }} /> : null}
        {TERMINAL.includes(d.status) && d.status !== "CANCELLED" && d.status !== "EXPIRED" ? <Muted>How was {driver?.name.split(" ")[0] ?? "the driver"}? Rating opens after delivery.</Muted> : null}
      </Sheet>
    </View>
  );
}
