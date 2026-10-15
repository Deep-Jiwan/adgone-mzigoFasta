# Web app design

The first front end: one web app with four role areas, built from React Native components rendered
with `react-native-web`. Code is in [`apps/web`](../apps/web/README.md). Everything runs on shared mock
data in the browser, so a request made as a customer shows up for drivers, the public link and admin.

## Reference

The look follows the Couriq shot by Orbix Studio on Dribbble
(<https://dribbble.com/shots/26770756-Couriq-Smart-Delivery-App-UI-with-Real-Time-Tracking-Courier>).
Images and the preview video are in [`design/reference/`](design/reference/), kept for internal design
reference only; they belong to the original designers. The 3D parcel and truck art in the shot is not
used. `apps/web/src/ui/Art.tsx` draws its own simple versions.

What we took from it:

| Idea | Where it shows up |
|---|---|
| Airy light home screen: address header, search with a dark scan button, two big tiles | Customer home |
| Floating dark pill navigation with a raised orange-ringed centre button | Customer and driver navigation |
| Dotted progress stepper with a truck on the current step | Shipment cards, tracking, public link |
| Dark bottom sheet over the map, with booking ID, status, from/to and a courier row with call and chat buttons | Customer tracking, public link |
| Chat with the courier, quick-reply chips, rounded bubbles | Customer chat |
| Palette: near-black `#060606`, warm off-white, orange `#E88E40` / `#D15F26`, slate `#667589` | `apps/web/src/theme.ts` |

## Themes

The whole UI reads from one theme (`apps/web/src/themes.ts`): a palette plus a few structural choices
(navigation style, progress-stepper style, card edges, typefaces, radii). Four are built:

| Theme | Idea |
|---|---|
| `classic` | The first build, closest to the Couriq reference (default) |
| `pwani` | Apple-light: system blue, hairline cards, frosted tab bar, solid progress line, white tracking sheet |
| `usiku` | Dark first: near-black, electric lime, segmented progress bar, dark map, Manrope |
| `savanna` | Warm and editorial: cream, forest green, marigold, Fraunces titles, dock navigation |

Pick one with `?theme=pwani|usiku|savanna|classic` (remembered in localStorage) or the chips in the
desktop role switcher. Screens use semantic tokens (`accent`, `text`, `panel`, `selected`, ...) and
never raw colours, so adding or tuning a theme only touches `themes.ts`. Fonts are self-hosted through
`@fontsource-variable` packages.

## Roles

| Role | Route | Layout | What it does |
|---|---|---|---|
| Customer | `/customer` | phone | Request a delivery, follow it on a live map, chat with the driver, share the tracking link, cancel |
| Driver | `/driver` | phone | Go online, see nearby jobs for their vehicle, accept, scan pickup QR, enter the recipient code, collect cash, wallet and trips |
| Public link | `/t/:token` | phone | What the recipient sees. No login. Live until delivered |
| Admin | `/admin` | desktop (responsive) | Overview, deliveries, drivers, customers, wallets and cash, safety and fraud, settings |

On a desktop the phone roles sit in a phone-shaped frame next to a role switcher. On a phone they
fill the screen.

## Settings drive the app

The decisions you made are admin settings, not code (`/admin/settings`). Saving applies to new
requests immediately:

- **Pricing model (Q-01):** platform price (with optional tips), customer offers a price, or drivers
  bid. The customer's "New delivery" screen changes with the setting.
- **Rates:** base, per km, minimum and max weight for each vehicle. Boda, bajaji and pickup are on at
  launch (Q-09); car and canter exist but are switched off.
- **Platform fee (Q-02):** percentage, fixed per job, or both. Taken from the driver's wallet.
- **Payments:** cash on. Mobile money is visible but disabled ("Coming soon").
- **Operations:** service area Dar es Salaam, hours 24/7 (Q-10), free-cancellation window.
- **Public link (Q-23):** refresh interval, driver first name on/off, partial plate on/off.

## Money in the UI

Cash is paid to the driver directly. The customer picks, when requesting, whether they pay at pickup
or the recipient pays at drop-off. The driver's job card says "Cash from recipient/sender", and the
drop-off step makes the driver confirm the cash before the delivery can be completed. MzigoFasta's
fee is held from the driver's wallet when they accept and charged when they deliver (PLAN.md §6). The
admin records cash top-ups by hand.

## Known limits of a web-only driver app

- **Background location:** browsers pause location updates when the screen is off or the tab is in
  the background. The driver has to keep the page open and the screen on during a job (the Screen
  Wake Lock API helps). Reliable background tracking needs a native wrapper later (Capacitor or Expo),
  which can reuse these components.
- **Camera:** QR scanning and parcel photos work in the browser through `getUserMedia`, but need HTTPS.
- **Push notifications:** job offers need web push, which is limited on iOS unless the app is
  installed to the home screen.

## Placeholders

- The map is a stylised SVG (`apps/web/src/ui/MapView.tsx`). It takes plain `lat/lng` props so a real
  provider (MapLibre or Google, Q-21) replaces one file.
- All data is mock and in memory (`apps/web/src/data`). The state machine is the real one from
  `@mzigo/contracts`, so rules match the backend. Wiring to `services/api` is the next step.
