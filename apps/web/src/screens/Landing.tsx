import { Pressable, ScrollView, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { c, radius } from "../theme";
import { BoxArt, TruckArt } from "../ui/Art";
import { Icon, type IconName } from "../ui/Icon";
import { Row, T, useIsDesktop } from "../ui/kit";

const CARDS: { title: string; body: string; to: string; icon: IconName; dark?: boolean }[] = [
  { title: "Customer", body: "Request a delivery, watch the driver live, chat, rate.", to: "/customer", icon: "box" },
  { title: "Driver", body: "Go online, accept jobs, scan, deliver, track earnings.", to: "/driver", icon: "bike" },
  { title: "Public tracking link", body: "What the recipient sees. No login, no phone numbers.", to: "/t/tk_mf24817x9f2", icon: "link" },
  { title: "Admin", body: "Deliveries, drivers, wallets, safety and every setting.", to: "/admin", icon: "sliders", dark: true },
];

export function Landing() {
  const nav = useNavigate();
  const desktop = useIsDesktop();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: desktop ? 56 : 20, gap: 32, maxWidth: 1080, width: "100%", alignSelf: "center" }}>
      <View style={{ gap: 12, paddingTop: desktop ? 24 : 12 }}>
        <Row gap={8}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}><Icon name="truck" size={20} color="#fff" /></View><T v="h2" weight="600">MzigoFasta</T></Row>
        <T v="display" style={{ fontSize: desktop ? 52 : 36, letterSpacing: -1.6, maxWidth: 640 }}>Deliveries across Dar es Salaam, tracked live.</T>
        <T v="body" color={c.slate} style={{ maxWidth: 560 }}>Four views of one system. Pick a role to explore. Requests made as a customer show up for drivers, the public link and the admin in real time.</T>
      </View>
      <View style={{ flexDirection: desktop ? "row" : "column", flexWrap: "wrap", gap: 16 }}>
        {CARDS.map((card) => (
          <Pressable
            key={card.title} onPress={() => nav(card.to)}
            style={{ flexGrow: 1, flexBasis: desktop ? "45%" : "auto", backgroundColor: card.dark ? c.ink : c.surface, borderRadius: radius.xl, padding: 24, gap: 14, minHeight: 180, overflow: "hidden", cursor: "pointer" }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: card.dark ? c.sheet2 : c.canvas, alignItems: "center", justifyContent: "center" }}><Icon name={card.icon} size={22} color={card.dark ? "#fff" : c.text} /></View>
            <T v="title" color={card.dark ? "#fff" : c.text}>{card.title}</T>
            <T v="body" color={card.dark ? "#B5B5BB" : c.slate} style={{ maxWidth: 300 }}>{card.body}</T>
            <View style={{ position: "absolute", right: -8, bottom: -8, opacity: card.dark ? 0.9 : 1 }}>{card.title === "Driver" || card.title === "Admin" ? <TruckArt size={120} /> : <BoxArt size={110} />}</View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
