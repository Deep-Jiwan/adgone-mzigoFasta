import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip, Muted, Row, Screen, T } from "../../ui/kit";
import { useStore } from "../../data/store";
import { ME_CUSTOMER, TERMINAL } from "../../data/model";
import { ShipmentRow } from "./parts";

const TABS = ["All", "Active", "Delivered", "Cancelled"] as const;

export function Shipments() {
  const { deliveries } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const mine = deliveries.filter((d) => d.senderId === ME_CUSTOMER);
  const list = mine.filter((d) =>
    tab === "All" ? true : tab === "Active" ? !TERMINAL.includes(d.status) : tab === "Delivered" ? d.status === "DELIVERED" || d.status === "CLOSED" : d.status === "CANCELLED" || d.status === "EXPIRED",
  );
  return (
    <Screen bottomPad={96}>
      <T v="display" style={{ paddingTop: 8 }}>Shipments</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <Row gap={8}>{TABS.map((t) => <Chip key={t} label={t} active={tab === t} onPress={() => setTab(t)} />)}</Row>
      </ScrollView>
      <View style={{ gap: 10 }}>
        {list.map((d) => <ShipmentRow key={d.id} d={d} />)}
        {list.length === 0 ? <Muted style={{ textAlign: "center", paddingTop: 40 }}>Nothing here yet.</Muted> : null}
      </View>
    </Screen>
  );
}
