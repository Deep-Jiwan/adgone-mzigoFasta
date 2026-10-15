# apps/web

MzigoFasta web app: customer, driver, public tracking link and admin. React Native components
rendered in the browser with `react-native-web`, bundled with Vite, deployed to Cloudflare Pages.
Design notes: [docs/DESIGN.md](../../docs/DESIGN.md).

```sh
pnpm install            # from the repo root
pnpm --filter @mzigo/web dev        # http://localhost:5173
pnpm --filter @mzigo/web typecheck
pnpm --filter @mzigo/web build      # → dist/
pnpm --filter @mzigo/web deploy     # Cloudflare Pages (needs `wrangler login`)
```

Themes: `?theme=classic|pwani|usiku|savanna` (see docs/DESIGN.md).

Routes: `/` role picker · `/customer` · `/driver` · `/t/:token` (public link) · `/admin`.

## Layout

```
src/themes.ts           the four themes (palette + nav/stepper/card style + fonts)
src/theme.ts            picks the active theme; exports c (colours), radius, shadow, font
src/ui/                 kit (text, buttons, cards, stepper), icons, art, MapView, phone frame, nav
src/data/model.ts       types, places, settings + pricing/fee maths, seed data
src/data/store.tsx      in-memory store shared by all roles; uses the real state machine from @mzigo/contracts
src/screens/            customer/ driver/ track/ admin/
```

Mock data only for now. Nothing here talks to `services/api` yet; the store's actions
(`createDelivery`, `act`, ...) are the seam to replace with API calls.

`public/_redirects` makes Cloudflare Pages serve `index.html` for every path (client-side routing).
