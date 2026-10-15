import { View } from "react-native";
import { Outlet, useLocation } from "react-router-dom";
import { FloatingNav, PhoneFrame, type NavItem } from "../../ui/Shell";

const ITEMS: NavItem[] = [
  { to: "/driver", label: "Jobs", icon: "list" },
  { to: "/driver/trips", label: "Trips", icon: "box" },
  { to: "/driver/job", label: "My job", icon: "nav", center: true },
  { to: "/driver/wallet", label: "Wallet", icon: "wallet" },
  { to: "/driver/profile", label: "Profile", icon: "user" },
];

export function DriverLayout() {
  const { pathname } = useLocation();
  const hideNav = pathname.startsWith("/driver/job");
  return (
    <PhoneFrame>
      <View style={{ flex: 1 }}>
        <Outlet />
        {hideNav ? null : <FloatingNav items={ITEMS} />}
      </View>
    </PhoneFrame>
  );
}
