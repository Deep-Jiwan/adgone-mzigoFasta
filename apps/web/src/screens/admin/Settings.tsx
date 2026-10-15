import { useState } from "react";
import { Pressable, View } from "react-native";
import { c, radius } from "../../theme";
import { Badge, Button, Card, Divider, Muted, Row, Segmented, T, Toggle, money, useToast } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { useStore } from "../../data/store";
import { type CommissionMode, type PricingMode, type Settings, type VehicleKey, commissionFor, quote } from "../../data/model";
import { NumInput, Page, SettingRow } from "./parts";

const MODES: { key: PricingMode; title: string; body: string }[] = [
  { key: "platform", title: "Platform price", body: "MzigoFasta sets the fee from distance and vehicle. Customers can add a tip." },
  { key: "shop_offer", title: "Customer offers a price", body: "Customers enter what they will pay. Drivers accept or ignore." },
  { key: "bidding", title: "Drivers bid", body: "Customer sets a starting offer. Drivers counter, customer picks." },
];

export function AdminSettings() {
  const { settings, saveSettings } = useStore();
  const [s, setS] = useState<Settings>(structuredClone(settings));
  const toast = useToast();
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = (fn: (d: Settings) => void) => setS((p) => { const n = structuredClone(p); fn(n); return n; });
  const vk = Object.keys(s.vehicles) as VehicleKey[];

  return (
    <Page
      title="Settings"
      sub="Everything below is a setting, not code. Changes apply to new requests straight away."
      actions={<Row gap={10}>{dirty ? <Button label="Discard" variant="light" small full={false} onPress={() => setS(structuredClone(settings))} /> : null}<Button label="Save changes" variant="accent" small full={false} disabled={!dirty} onPress={() => { saveSettings(s); toast.show("Saved. New requests use these settings."); }} /></Row>}
    >
      {toast.node}

      <Card style={{ gap: 14 }}>
        <T v="h2">How delivery prices are set</T>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          {MODES.map((m) => {
            const on = s.pricingMode === m.key;
            return (
              <Pressable key={m.key} onPress={() => set((d) => { d.pricingMode = m.key; })} style={{ flexGrow: 1, flexBasis: 240, padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? c.selected : c.line, gap: 6, cursor: "pointer", backgroundColor: on ? c.paper : c.surface }}>
                <Row justify="space-between"><T v="body" weight="600">{m.title}</T>{on ? <Icon name="check" size={18} color={c.accent} strokeWidth={3} /> : null}</Row>
                <Muted>{m.body}</Muted>
              </Pressable>
            );
          })}
        </View>
        <SettingRow title="Allow tips (platform price mode)" sub="Customers can add a tip so a job is taken faster."><Toggle on={s.tipsEnabled} onChange={(v) => set((d) => { d.tipsEnabled = v; })} /></SettingRow>
      </Card>

      <Card style={{ gap: 6 }}>
        <T v="h2">Vehicles and rates</T>
        <Muted>Price = base + per km, never below the minimum, rounded to TZS 500. Preview is for an 8 km trip.</Muted>
        <View style={{ marginTop: 8 }}>
          {vk.map((k, i) => {
            const v = s.vehicles[k];
            return (
              <View key={k}>
                {i ? <Divider /> : null}
                <Row gap={16} style={{ flexWrap: "wrap" }}>
                  <Row gap={10} style={{ width: 150 }}><Toggle on={v.enabled} onChange={(on) => set((d) => { d.vehicles[k].enabled = on; })} /><T v="body" weight="600">{v.label}</T></Row>
                  <View style={{ opacity: v.enabled ? 1 : 0.4, flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                    <View style={{ gap: 4 }}><Muted v="tiny">Base</Muted><NumInput value={v.base} onChange={(n) => set((d) => { d.vehicles[k].base = n; })} /></View>
                    <View style={{ gap: 4 }}><Muted v="tiny">Per km</Muted><NumInput value={v.perKm} onChange={(n) => set((d) => { d.vehicles[k].perKm = n; })} /></View>
                    <View style={{ gap: 4 }}><Muted v="tiny">Minimum</Muted><NumInput value={v.min} onChange={(n) => set((d) => { d.vehicles[k].min = n; })} /></View>
                    <View style={{ gap: 4 }}><Muted v="tiny">Max weight</Muted><NumInput value={v.maxKg} suffix="kg" onChange={(n) => set((d) => { d.vehicles[k].maxKg = n; })} width={110} /></View>
                    <View style={{ gap: 4 }}><Muted v="tiny">8 km trip</Muted><T v="body" weight="600" style={{ paddingVertical: 12 }}>{money(quote(s, k, 8))}</T></View>
                  </View>
                </Row>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <T v="h2">Platform fee (how MzigoFasta earns)</T>
        <Muted>Taken from the driver's wallet when they deliver. Customers never pay it.</Muted>
        <View style={{ marginVertical: 8 }}>
          <Segmented<CommissionMode> value={s.commission.mode} onChange={(m) => set((d) => { d.commission.mode = m; })} options={[{ key: "percent", label: "Percentage" }, { key: "fixed", label: "Fixed per job" }, { key: "both", label: "Both" }]} />
        </View>
        {s.commission.mode !== "fixed" ? <SettingRow title="Percentage of the delivery price"><NumInput value={s.commission.percent} suffix="%" onChange={(n) => set((d) => { d.commission.percent = Math.min(50, n); })} /></SettingRow> : null}
        {s.commission.mode !== "percent" ? <SettingRow title="Fixed fee per job"><NumInput value={s.commission.fixed} suffix="TZS" onChange={(n) => set((d) => { d.commission.fixed = n; })} width={150} /></SettingRow> : null}
        <Badge tone="accent">A TZS 10,000 boda job costs the driver {money(commissionFor(s, 10000))}</Badge>
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="h2">Payments</T>
        <SettingRow title="Cash" sub="Customer or recipient pays the driver in cash. Chosen on each request."><Toggle on={s.payments.cash} onChange={(v) => set((d) => { d.payments.cash = v; })} /></SettingRow>
        <Divider />
        <SettingRow title="Mobile money" sub="M-Pesa, Mixx, Airtel Money, HaloPesa. Needs an aggregator (not chosen yet)."><Row gap={10}><Badge>Coming soon</Badge><Toggle on={false} disabled /></Row></SettingRow>
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="h2">Operations</T>
        <SettingRow title="Service area" sub="Delivery requests outside this area are refused."><Badge tone="neutral">{s.operations.area}</Badge></SettingRow>
        <Divider />
        <SettingRow title="Operating hours"><Badge tone="green">{s.operations.hours}</Badge></SettingRow>
        <Divider />
        <SettingRow title="Free cancellation window" sub="Minutes after a driver accepts."><NumInput value={s.cancellation.freeMinutes} suffix="min" onChange={(n) => set((d) => { d.cancellation.freeMinutes = n; })} /></SettingRow>
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="h2">Public tracking link</T>
        <Muted>Live until the delivery is marked delivered. No phone numbers or delivery code are ever shown.</Muted>
        <SettingRow title="Position refresh"><NumInput value={s.tracking.refreshSeconds} suffix="sec" onChange={(n) => set((d) => { d.tracking.refreshSeconds = Math.max(2, n); })} /></SettingRow>
        <Divider />
        <SettingRow title="Show driver's first name"><Toggle on={s.tracking.showDriverFirstName} onChange={(v) => set((d) => { d.tracking.showDriverFirstName = v; })} /></SettingRow>
        <Divider />
        <SettingRow title="Show partial plate"><Toggle on={s.tracking.showPlate} onChange={(v) => set((d) => { d.tracking.showPlate = v; })} /></SettingRow>
      </Card>
    </Page>
  );
}
