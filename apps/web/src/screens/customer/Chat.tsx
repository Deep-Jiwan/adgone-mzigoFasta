import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import { c, noOutline } from "../../theme";
import { Avatar, RoundButton, Row, T } from "../../ui/kit";
import { Icon } from "../../ui/Icon";
import { useStore } from "../../data/store";

interface Msg { id: number; mine: boolean; text: string; at: string }
const time = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const REPLIES = ["Sawa, nakuja! I'm almost there.", "Traffic at Morocco junction, 5 more minutes.", "I've arrived. Please come to the gate.", "Got it, thanks 👍"];
const QUICK = ["Share live location", "Call courier", "Delivery time update", "Gate is open"];

export function Chat() {
  const { id } = useParams();
  const nav = useNavigate();
  const { deliveries, drivers } = useStore();
  const d = deliveries.find((x) => x.id === id);
  const driver = drivers.find((x) => x.id === d?.driverId);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, mine: true, text: "Hey, just checking — has my parcel left yet?", at: "9:15 AM" },
    { id: 2, mine: false, text: "Yes, it's on the way now 🏍️ I've just left Kariakoo.", at: "9:18 AM" },
  ]);
  const [text, setText] = useState("");
  const scroller = useRef<ScrollView>(null);
  useEffect(() => { scroller.current?.scrollToEnd({ animated: true }); }, [msgs]);

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { id: m.length + 1, mine: true, text: t, at: time() }]);
    setText("");
    setTimeout(() => setMsgs((m) => [...m, { id: m.length + 1, mine: false, text: REPLIES[m.length % REPLIES.length]!, at: time() }]), 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Row gap={12} style={{ padding: 16, paddingTop: 20 }}>
        <RoundButton icon="back" bg={c.surface} fg={c.ink} size={44} onPress={() => nav(-1)} />
        <Avatar name={driver?.name ?? "Driver"} size={46} />
        <View style={{ flex: 1 }}>
          <T v="h2" weight="600">{driver?.name ?? "Driver"}</T>
          <T v="small" color={c.muted}>Courier — {d?.pickup.area} → {d?.dropoff.area}</T>
          <Row gap={6}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.green }} /><T v="tiny" color={c.slate}>Active now</T></Row>
        </View>
        <RoundButton icon="phone" bg={c.canvas} fg={c.ink} />
      </Row>

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 14 }} style={{ flex: 1 }}>
        {msgs.map((m) => (
          <View key={m.id} style={{ alignItems: m.mine ? "flex-end" : "flex-start", gap: 4 }}>
            <View style={{ maxWidth: "78%", backgroundColor: m.mine ? c.ink : c.canvas, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, borderBottomRightRadius: m.mine ? 6 : 22, borderBottomLeftRadius: m.mine ? 22 : 6 }}>
              <T v="body" color={m.mine ? "#fff" : c.ink}>{m.text}</T>
            </View>
            <T v="tiny" color={c.muted}>{m.at}</T>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingBottom: 18, gap: 10, borderTopWidth: 1, borderTopColor: c.line }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
          {QUICK.map((q) => <Pressable key={q} onPress={() => send(q)} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, cursor: "pointer" }}><T v="small" weight="500">{q}</T></Pressable>)}
        </ScrollView>
        <Row gap={10} style={{ marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 30, padding: 6, paddingLeft: 14, borderWidth: 1, borderColor: c.line }}>
          <Icon name="plus" size={20} color={c.muted} />
          <TextInput value={text} onChangeText={setText} onSubmitEditing={() => send(text)} placeholder="Type your message…" placeholderTextColor={c.muted} style={[{ flex: 1, fontSize: 15, paddingVertical: 10 }, noOutline]} />
          <RoundButton icon="send" size={44} onPress={() => send(text)} />
        </Row>
      </View>
    </View>
  );
}
