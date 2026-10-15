import { type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { c, cursor, noOutline, radius } from "../../theme";
import { Badge, Card, Muted, Row, T, type Tone, useIsDesktop } from "../../ui/kit";

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ padding: desktop ? 32 : 16, gap: 20, maxWidth: 1280, width: "100%", alignSelf: "center" }}>
      <Row justify="space-between" align="flex-start" style={{ flexWrap: "wrap" }}>
        <View style={{ gap: 4 }}><T v="display" style={{ fontSize: desktop ? 30 : 26 }}>{title}</T>{sub ? <Muted v="body">{sub}</Muted> : null}</View>
        {actions}
      </Row>
      {children}
    </ScrollView>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 170, gap: 6, padding: 18 }}>
      <Muted>{label}</Muted>
      <T v="title" style={{ fontSize: 26 }}>{value}</T>
      {sub ? <Badge tone={tone ?? "neutral"}>{sub}</Badge> : null}
    </Card>
  );
}

export interface Col<R> { title: string; flex?: number; width?: number; render: (r: R) => ReactNode; align?: "flex-start" | "flex-end" }

export function DataTable<R extends { id: string }>({ cols, rows, onRow, selected, empty = "Nothing to show." }: {
  cols: Col<R>[]; rows: R[]; onRow?: (r: R) => void; selected?: string; empty?: string;
}) {
  const desktop = useIsDesktop();
  const min = cols.reduce((n, col) => n + (col.width ?? (col.flex ?? 1) * 120), 0);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: desktop ? "100%" : min }}>
        <View style={{ flex: 1, minWidth: desktop ? undefined : min }}>
          <Row gap={12} style={{ paddingHorizontal: 18, paddingVertical: 12, backgroundColor: c.paper, borderBottomWidth: 1, borderBottomColor: c.line }}>
            {cols.map((col) => <View key={col.title} style={{ flex: col.width ? undefined : col.flex ?? 1, width: col.width, alignItems: col.align }}><T v="tiny" color={c.muted} weight="600">{col.title.toUpperCase()}</T></View>)}
          </Row>
          {rows.length === 0 ? <View style={{ padding: 28, alignItems: "center" }}><Muted>{empty}</Muted></View> : null}
          {rows.map((r) => (
            <Pressable
              key={r.id} onPress={() => onRow?.(r)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: selected === r.id ? c.orangeSoft : "transparent", cursor: cursor(onRow ? "pointer" : "default") }}
            >
              {cols.map((col) => <View key={col.title} style={{ flex: col.width ? undefined : col.flex ?? 1, width: col.width, alignItems: col.align }}>{col.render(r)}</View>)}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

/** Side panel on desktop, stacked under the table on small screens. */
export function SplitView({ main, panel }: { main: ReactNode; panel?: ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <View style={{ flexDirection: desktop ? "row" : "column", gap: 20, alignItems: "flex-start" }}>
      <View style={{ flex: 1, width: "100%", minWidth: 0 }}>{main}</View>
      {panel ? <View style={{ width: desktop ? 380 : "100%" }}>{panel}</View> : null}
    </View>
  );
}

export function SettingRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <Row justify="space-between" align="center" style={{ paddingVertical: 10, gap: 20, flexWrap: "wrap" }}>
      <View style={{ flex: 1, minWidth: 220 }}><T v="body" weight="500">{title}</T>{sub ? <Muted>{sub}</Muted> : null}</View>
      {children}
    </Row>
  );
}

export function NumInput({ value, onChange, suffix, width = 120 }: { value: number; onChange: (n: number) => void; suffix?: string; width?: number }) {
  return (
    <Row gap={6} style={{ backgroundColor: c.canvas, borderRadius: radius.md, paddingHorizontal: 12, width }}>
      <TextInput
        value={String(value)} keyboardType="numeric"
        onChangeText={(t) => { const n = Number(t.replace(/\D/g, "")); onChange(Number.isFinite(n) ? n : 0); }}
        style={[{ flex: 1, fontSize: 15, paddingVertical: 13, minWidth: 0, color: c.ink }, noOutline]}
      />
      {suffix ? <Muted>{suffix}</Muted> : null}
    </Row>
  );
}
