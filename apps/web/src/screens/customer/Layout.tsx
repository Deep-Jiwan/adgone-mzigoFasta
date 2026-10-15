import { View } from "react-native";
import { Outlet, useLocation } from "react-router-dom";
import { FloatingNav, PhoneFrame, type NavItem } from "../../ui/Shell";

const ITEMS: NavItem[] = [
  { to: "/customer", label: "Home", icon: "home" },
  { to: "/customer/shipments", label: "Shipment", icon: "box" },
  { to: "/customer/new", label: "New", icon: "plus", center: true },
  { to: "/customer/track", label: "Tracking", icon: "pin", match: ["/customer/track"] },
  { to: "/customer/profile", label: "Profile", icon: "user" },
];

export function CustomerLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/customer/new") || pathname.startsWith("/customer/track/") || pathname.startsWith("/customer/chat");
  return (
    <PhoneFrame>
      <View style={{ flex: 1 }}>
        <Outlet />
        {hideNav ? null : <FloatingNav items={ITEMS} />}
      </View>
    </PhoneFrame>
  );
}
