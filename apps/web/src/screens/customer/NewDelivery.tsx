import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { c, radius } from "../../theme";
import { Icon, type IconName } from "../../ui/Icon";
import { Button, Card, Chip, Field, Muted, Row, Segmented, T, Toggle, TopBar, money } from "../../ui/kit";
import { useStore } from "../../data/store";
import { PLACES, type Payer, type Place, type VehicleKey, commissionFor, distanceKm, etaMinutes, quote } from "../../data/model";

const VEHICLE_ICON: Record<VehicleKey, IconName> = { boda: "bike", bajaji: "tuk", pickup: "pickup", car: "truck", canter: "truck" };

function PlacePicker({ label, value, onPick, tone }: { label: string; value?: Place; onPick: (p: Place) => void; tone: "from" | "to" }) {
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState("");
  const list = PLACES.filter((p) => (p.name + p.area).toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tone === "from" ? c.surface : c.accentSoft, borderWidth: tone === "from" ? 3 : 0, borderColor: c.text }}>
          {tone === "to" ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Muted v="tiny">{label}</Muted>
          <T v="body" weight="500">{value ? `${value.name}, ${value.area}` : "Choose a place"}</T>
        </View>
        <Icon name="chevron" size={18} color={c.muted} />
      </Pressable>
      {open ? (
        <View style={{ gap: 8, paddingLeft: 40 }}>
          <Field value={q} onChangeText={setQ} placeholder="Search Dar es Salaam" icon="search" />
          <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
            {list.map((p) => (
              <Pressable key={p.name} onPress={() => { onPick(p); setOpen(false); setQ(""); }} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, cursor: "pointer" }}>
                <T v="small" weight="500">{p.name}</T><Muted v="tiny">{p.area}</Muted>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function NewDelivery() {
  const nav = useNavigate();
  const { settings, createDelivery } = useStore();
  const [pickup, setPickup] = useState<Place | undefined>(PLACES[0]);
  const [dropoff, setDropoff] = useState<Place | undefined>();
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [item, setItem] = useState("");
  const [weight, setWeight] = useState("3");
  const [value, setValue] = useState("100000");
  const [vehicle, setVehicle] = useState<VehicleKey>("boda");
  const [tip, setTip] = useState(0);
  const [offer, setOffer] = useState("");
  const [method, setMethod] = useState<"cash" | "mobile">("cash");
  const [payer, setPayer] = useState<Payer>("recipient");

  const km = pickup && dropoff ? distanceKm(pickup, dropoff) : 0;
  const w = Number(weight) || 0;
  const enabled = (Object.keys(settings.vehicles) as VehicleKey[]).filter((k) => settings.vehicles[k].enabled);
  const suggested = km ? quote(settings, vehicle, km) : 0;
  const mode = settings.pricingMode;
  const base = mode === "platform" ? suggested : Number(offer) || suggested;
  const total = base + (mode === "platform" ? tip : 0);
  const valid = pickup && dropoff && recipientName.trim() && recipientPhone.trim().length >= 9 && w <= settings.vehicles[vehicle].maxKg && base > 0;
  const fee = useMemo(() => commissionFor(settings, base), [settings, base]);

  const submit = () => {
    if (!pickup || !dropoff) return;
    const id = createDelivery({
      item, weightKg: w, valueTzs: Number(value) || 0, vehicle, pickup, dropoff, recipientName, recipientPhone, payer, paymentMethod: method, tip: mode === "platform" ? tip : 0,
      offer: mode === "platform" ? undefined : base,
    });
    nav(`/customer/track/${id}`, { replace: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar title="New Delivery" onBack={() => nav(-1)} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: 14 }}>
          <PlacePicker label="Pickup" tone="from" value={pickup} onPick={setPickup} />
          <View style={{ height: 14, borderLeftWidth: 2, borderStyle: "dotted", borderColor: c.accent, marginLeft: 13, marginVertical: -6 }} />
          <PlacePicker label="Drop-off" tone="to" value={dropoff} onPick={setDropoff} />
          {km ? <Row gap={6}><Icon name="map" size={16} color={c.slate} /><Muted>{km} km · about {etaMinutes(settings, vehicle, km)} min</Muted></Row> : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <T v="h2">Who receives it?</T>
          <Field label="Recipient name" value={recipientName} onChangeText={setRecipientName} placeholder="Amina Said" icon="user" />
          <Field label="Recipient phone" value={recipientPhone} onChangeText={setRecipientPhone} placeholder="713 000 000" keyboardType="phone-pad" prefix="+255" />
          <Muted>They get an SMS with the tracking link and a 4-digit code to give the driver.</Muted>
        </Card>

        <Card style={{ gap: 12 }}>
          <T v="h2">What are you sending?</T>
          <Field label="Item" value={item} onChangeText={setItem} placeholder="e.g. 2 boxes of phone cases" icon="box" />
          <Row gap={12}>
            <View style={{ flex: 1 }}><Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Value (TZS)" value={value} onChangeText={setValue} keyboardType="numeric" /></View>
          </Row>
        </Card>

        <Card style={{ gap: 10 }}>
          <T v="h2">Choose a vehicle</T>
          {enabled.map((k) => {
            const v = settings.vehicles[k];
            const tooHeavy = w > v.maxKg;
            const sel = vehicle === k;
            return (
              <Pressable
                key={k} onPress={() => !tooHeavy && setVehicle(k)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: sel ? c.selected : c.line, opacity: tooHeavy ? 0.45 : 1, cursor: "pointer" }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sel ? c.selected : c.canvas, alignItems: "center", justifyContent: "center" }}><Icon name={VEHICLE_ICON[k]} size={22} color={sel ? c.onSelected : c.text} /></View>
                <View style={{ flex: 1 }}><T v="body" weight="600">{v.label}</T><Muted v="tiny">{tooHeavy ? `Too heavy (max ${v.maxKg} kg)` : v.hint}</Muted></View>
                <View style={{ alignItems: "flex-end" }}>
                  <T v="body" weight="600">{km ? money(quote(settings, k, km)) : "—"}</T>
                  {km ? <Muted v="tiny">{etaMinutes(settings, k, km)} min</Muted> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Card style={{ gap: 12 }}>
          <T v="h2">{mode === "platform" ? "Price" : mode === "shop_offer" ? "Your price" : "Your starting offer"}</T>
          {mode === "platform" ? (
            <>
              <Row justify="space-between"><Muted>Delivery fee (set by MzigoFasta)</Muted><T v="body" weight="600">{km ? money(suggested) : "—"}</T></Row>
              {settings.tipsEnabled ? (
                <View style={{ gap: 8 }}>
                  <Muted>Add a tip to get picked up faster</Muted>
                  <Row gap={8} style={{ flexWrap: "wrap" }}>{[0, 1000, 2000, 5000].map((t) => <Chip key={t} label={t ? `+${t.toLocaleString()}` : "No tip"} active={tip === t} onPress={() => setTip(t)} />)}</Row>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Field value={offer} onChangeText={setOffer} placeholder={suggested ? String(suggested) : "Enter amount"} keyboardType="numeric" prefix="TZS" />
              <Muted>{mode === "bidding" ? "Drivers can accept or counter-offer. You pick the one you like." : "Drivers can accept or ignore your price."} Suggested: {km ? money(suggested) : "—"}</Muted>
            </>
          )}
        </Card>

        <Card style={{ gap: 12 }}>
          <T v="h2">How will the driver be paid?</T>
          <Segmented value={method} onChange={setMethod} options={[{ key: "cash", label: "Cash" }, { key: "mobile", label: "Mobile money · soon", disabled: !settings.payments.mobileMoney }]} />
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1, paddingRight: 12 }}><T v="body" weight="500">Recipient pays on delivery</T><Muted v="tiny">Off: you pay the driver in cash at pickup.</Muted></View>
            <Toggle on={payer === "recipient"} onChange={(on) => setPayer(on ? "recipient" : "sender")} />
          </Row>
          <Muted>Cash goes straight to the driver. MzigoFasta's {money(fee)} fee is taken from the driver's wallet, not from you.</Muted>
        </Card>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 22, backgroundColor: c.ink, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 }}>
        <Row justify="space-between">
          <View><Muted v="tiny">Total, paid in cash</Muted><T v="title" color="#fff">{km ? money(total) : "—"}</T></View>
          <View style={{ flex: 1, maxWidth: 190 }}><Button label="Request driver" variant="accent" disabled={!valid} onPress={submit} /></View>
        </Row>
      </View>
    </View>
  );
}
