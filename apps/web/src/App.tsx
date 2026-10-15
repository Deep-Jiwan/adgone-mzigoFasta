import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { StoreProvider } from "./data/store";
import { Landing } from "./screens/Landing";
import { CustomerLayout } from "./screens/customer/Layout";
import { CustomerHome } from "./screens/customer/Home";
import { Shipments } from "./screens/customer/Shipments";
import { NewDelivery } from "./screens/customer/NewDelivery";
import { TrackDelivery } from "./screens/customer/TrackDelivery";
import { Chat } from "./screens/customer/Chat";
import { CustomerProfile } from "./screens/customer/Profile";
import { DriverLayout } from "./screens/driver/Layout";
import { Jobs } from "./screens/driver/Jobs";
import { ActiveJob } from "./screens/driver/ActiveJob";
import { Trips } from "./screens/driver/Trips";
import { Wallet } from "./screens/driver/Wallet";
import { DriverProfile } from "./screens/driver/Profile";
import { PublicTrack } from "./screens/track/PublicTrack";
import { AdminLayout } from "./screens/admin/Layout";
import { Overview } from "./screens/admin/Overview";
import { AdminDeliveries } from "./screens/admin/Deliveries";
import { AdminDrivers } from "./screens/admin/Drivers";
import { AdminCustomers } from "./screens/admin/Customers";
import { AdminWallets } from "./screens/admin/Wallets";
import { AdminSafety } from "./screens/admin/Safety";
import { AdminSettings } from "./screens/admin/Settings";

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route path="/customer" element={<CustomerLayout />}>
            <Route index element={<CustomerHome />} />
            <Route path="shipments" element={<Shipments />} />
            <Route path="new" element={<NewDelivery />} />
            <Route path="track" element={<TrackDelivery />} />
            <Route path="track/:id" element={<TrackDelivery />} />
            <Route path="chat/:id" element={<Chat />} />
            <Route path="profile" element={<CustomerProfile />} />
          </Route>

          <Route path="/driver" element={<DriverLayout />}>
            <Route index element={<Jobs />} />
            <Route path="job" element={<ActiveJob />} />
            <Route path="job/:id" element={<ActiveJob />} />
            <Route path="trips" element={<Trips />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="profile" element={<DriverProfile />} />
          </Route>

          <Route path="/t/:token" element={<PublicTrack />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="deliveries" element={<AdminDeliveries />} />
            <Route path="drivers" element={<AdminDrivers />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="wallets" element={<AdminWallets />} />
            <Route path="safety" element={<AdminSafety />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
