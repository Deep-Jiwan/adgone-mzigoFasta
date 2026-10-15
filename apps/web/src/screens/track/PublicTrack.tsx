import { Linking, View } from "react-native";
import { useParams } from "react-router-dom";
import { c } from "../../theme";
import { Avatar, Badge, Button, Divider, DotStepper, Muted, Row, T, money } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { MapView } from "../../ui/MapView";
import { PhoneFrame, Sheet } from "../../ui/Shell";
import { useStore } from "../../data/store";
import { STATUS_LABEL, STATUS_TONE, etaMinutes, stepIndex } from "../../data/model";

/**
 * The recipient's page: no login, no phone numbers, no delivery code. It stays live until the
 * delivery is delivered; after that it only shows the summary (the API stops serving positions).
 */
export function PublicTrack() {
  const { token } = useParams();
  const { deliveries, drivers, settings } = useStore();
  const d = deliveries.find((x) => x.token === token);

  if (!d) {
    return (
      <PhoneFrame switcher>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <Icon name="link" size={36} color={c.muted} /><T v="title">Link not found</T><Muted>This tracking link is invalid or has expired.</Muted>
        </View>
      </PhoneFrame>
    );
  }

  const driver = drivers.find((x) => x.id === d.driverId);
  const finished = d.status === "DELIVERED" || d.status === "CLOSED";
  const cancelled = d.status === "CANCELLED" || d.status === "EXPIRED";
  const idx = stepIndex(d.status);
  const phase = d.status === "ACCEPTED" ? "toPickup" : d.status === "PICKED_UP" ? "toDropoff" : "none";
  const total = etaMinutes(settings, d.vehicle, d.km);
  const left = phase === "toDropoff" ? Math.max(1, Math.round(total * (1 - d.leg))) : phase === "toPickup" ? Math.round(total + 4 * (1 - d.leg)) : total;
  const arrive = new Date(Date.now() + left * 60000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const t = settings.tracking;
  const plate = driver ? driver.plate.replace(/\d{3}/, "•••") : "";
  const headline = finished ? "Delivered" : cancelled ? "Delivery cancelled" : d.status === "OPEN" ? "Finding a driver" : d.status === "AT_DROPOFF" ? "Your driver has arrived" : phase === "toDropoff" ? `${left} min away` : "Driver collecting your parcel";

  return (
    <PhoneFrame>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View>
          <MapView pickup={d.pickup} dropoff={d.dropoff} phase={finished || cancelled ? "none" : phase} leg={d.leg} height={330} seed={d.id} />
          <Row justify="space-between" style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
            <Row gap={8} style={{ backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 }}><Icon name="truck" size={16} /><T v="small" weight="600">MzigoFasta</T></Row>
            {!finished && !cancelled ? <Row gap={6} style={{ backgroundColor: c.ink, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.green }} /><T v="tiny" color="#fff">LIVE · updates every {t.refreshSeconds}s</T></Row> : null}
          </Row>
        </View>

        <Sheet>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <T v="small" color={c.onPanelMuted}>{finished ? "Completed" : cancelled ? "Status" : "Arriving about " + arrive}</T>
              <T v="display" color={c.onPanel} style={{ fontSize: 28 }}>{headline}</T>
            </View>
            <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
          </Row>
          {!cancelled ? <DotStepper steps={5} done={Math.max(0, idx - 1)} truckAt={idx < 5 ? idx - 1 : undefined} dark /> : null}
          <Row justify="space-between">
            <View><T v="small" color={c.onPanelMuted}>From</T><T v="body" color={c.onPanel} weight="500">{d.pickup.name}</T></View>
            <View style={{ alignItems: "flex-end" }}><T v="small" color={c.onPanelMuted}>To</T><T v="body" color={c.onPanel} weight="500">{d.dropoff.name}</T></View>
          </Row>
          <Divider dark />

          {driver && !finished && !cancelled ? (
            <Row gap={12} style={{ backgroundColor: c.panel2, borderRadius: 24, padding: 12 }}>
              <Avatar name={driver.name} size={48} ring />
              <View style={{ flex: 1 }}>
                <T v="body" color={c.onPanel} weight="600">{t.showDriverFirstName ? driver.name.split(" ")[0] : "Your driver"}</T>
                <T v="small" color={c.onPanelMuted}>{settings.vehicles[driver.vehicle].label}{t.showPlate ? ` · ${plate}` : ""} · ★ {driver.rating}</T>
              </View>
            </Row>
          ) : null}

          <Row gap={12} align="flex-start">
            <View style={{ flex: 1, gap: 14 }}>
              <View><T v="small" color={c.onPanelMuted}>Item</T><T v="body" color={c.onPanel} weight="500">{d.item}</T></View>
              <View><T v="small" color={c.onPanelMuted}>Order</T><T v="body" color={c.onPanel} weight="500">{d.id}</T></View>
            </View>
            <View style={{ flex: 1, gap: 14 }}>
              <View><T v="small" color={c.onPanelMuted}>Recipient</T><T v="body" color={c.onPanel} weight="500">{d.recipientName}</T></View>
              {d.payer === "recipient" && !finished ? <View><T v="small" color={c.onPanelMuted}>Pay driver on delivery (cash)</T><T v="body" color={c.accent} weight="600">{money(d.price + d.tip)}</T></View> : null}
            </View>
          </Row>

          {!finished && !cancelled && d.status !== "OPEN" ? (
            <View style={{ backgroundColor: c.panel2, borderRadius: 20, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Icon name="lock" size={20} color={c.accent} />
              <T v="small" color={c.onPanelMuted} style={{ flex: 1 }}>Have your 4-digit delivery code ready. It was sent to you by SMS. Only give it to the driver at the door.</T>
            </View>
          ) : null}
          {finished ? <T v="small" color={c.onPanelMuted}>Thanks for using MzigoFasta. This link no longer shows live location.</T> : null}

          <Button label="Need help? WhatsApp support" icon="chat" variant="light" onPress={() => Linking.openURL("https://wa.me/255700000000")} />
        </Sheet>
      </View>
    </PhoneFrame>
  );
}
