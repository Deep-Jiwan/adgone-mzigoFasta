# Product plan

Working name: **MzigoFasta** ("fast cargo"). Launch city: Dar es Salaam. Target: all of Tanzania.

Open decisions referenced below as `Q-xx` live in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
The technical design is in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. The idea in one paragraph

A shop needs goods moved across town. Today it calls a boda rider it knows, or a friend of a
friend with a canter, and then has no idea where the goods are until the customer calls. We give
the shop a button: post the job, the nearest suitable driver accepts within minutes, the shop sees
the driver on a map, the handover is documented, the customer gets a tracking link, delivery is
confirmed with a code, and everyone is rated. It is Bolt/Uber, but for goods, and the shop (not a
passenger) is the customer.

## 2. Who uses it

| Actor | Device | What they need |
|---|---|---|
| **Shop** (owner or staff) | Phone or laptop at the counter (web app) | Post jobs fast, see where goods are, proof that goods were delivered, a history for disputes and accounting |
| **Driver** (boda, bajaji, car, pickup, canter) | Low-to-mid range Android phone (native app) | A steady stream of nearby jobs that fit the vehicle, clear pickup/drop-off pins, fast and fair pay |
| **Recipient** (the shop's customer) | Any phone with a browser, often via WhatsApp | Know when goods arrive. No app install, no account |
| **Ops / admin** (us) | Laptop (web app) | Approve drivers, handle disputes, see live operations, suspend bad actors |

## 3. Core journey

```mermaid
sequenceDiagram
    autonumber
    actor S as Shop
    participant P as Platform
    actor D as Driver
    actor R as Recipient

    S->>P: Post delivery (pickup, drop-off pin, vehicle class, goods, value, recipient phone)
    P->>D: Offer to nearby online drivers with matching vehicle
    D->>P: Accept (first valid accept wins; driver wallet must cover the commission)
    P-->>S: Assigned: driver name, photo, plate, rating, live position
    D->>S: Call shop (tap to call)
    D->>P: Live location while on the job
    P-->>S: Live map
    S->>R: Share public tracking link (WhatsApp/SMS)
    D->>P: At pickup: scan delivery-note QR + photo of goods
    P-->>S: Picked up (shop signs off on handover)
    P-->>R: Tracking link shows position (refresh every ~5 min) + ETA
    R->>D: Gives 4-digit delivery code
    D->>P: Enter code + photo (+ optional signature)
    P-->>S: Delivered, signed proof-of-delivery PDF
    P-->>R: Delivered, receipt PDF
    P->>D: Commission charged to driver wallet
    S->>P: Rate driver
    D->>P: Rate shop
```

### Delivery states

```
DRAFT → OPEN → ACCEPTED → AT_PICKUP → PICKED_UP → AT_DROPOFF → DELIVERED → CLOSED
          │        │           │            │             │
          ▼        ▼           ▼            ▼             ▼
       EXPIRED  CANCELLED  CANCELLED     FAILED ──► RETURNING ──► RETURNED
```

- `EXPIRED`: no driver accepted within the window (e.g. 15 min). Shop can repost.
- `CANCELLED`: by shop or driver, always with a reason. Late cancellations may carry a fee (Q-07).
- `FAILED`: recipient unreachable or refuses. Goods go back to the shop (`RETURNING` → `RETURNED`).
- Every transition is stored as an append-only event with who, when and where. That event log is
  the audit trail for disputes.

## 4. The "documents" step: proof of handover and proof of delivery

Your idea of a digital document exchange becomes a **chain of custody** with two checkpoints:

1. **Delivery note (waybill).** Created when the shop posts the job: items, quantity, declared
   value, notes, recipient name and phone, and a QR code.
2. **Pickup checkpoint.** The driver scans the QR (proves they are at the right shop with the right
   job) and photographs the goods. The shop taps "handed over". Now custody has moved to the driver.
3. **Delivery checkpoint.** The recipient receives a 4-digit code by SMS when the goods are picked
   up. The driver enters it at the door, photographs the goods at the destination, and optionally
   captures a signature. Custody moves to the recipient.
4. **Proof of delivery (POD).** A PDF is generated automatically with both checkpoints, GPS
   positions and timestamps of each, photos and the signature. Shop and recipient both receive it.

No code = no "delivered". That single rule prevents most fake deliveries.

## 5. Scope by phase

### Phase 0: validate (before writing much code)
- Interview 10–15 shops (electronics, pharmacies, wholesale in Kariakoo, hardware) and 20+ drivers
  across vehicle classes. Confirm prices people pay today, how often, and what goes wrong.
- Answer the blocking questions in OPEN_QUESTIONS.md (pricing, money flow, driver model).
- Click-through prototype of the three apps in Swahili.

### Phase 1: MVP (one city, shop pays the driver directly, platform earns via the driver wallet)
- Phone number + SMS code login for shops and drivers.
- Shop profile, multiple staff per shop.
- Driver sign-up with documents, **manual approval by ops** before going online.
- **Pickup locations** for each shop (storefront, godown, …), each with a pin, landmark text and a
  required **storefront photo** shown to the driver (see §7).
- Post a delivery with map pins, landmark text, vehicle class, goods description, declared value.
- Job offers to nearby online drivers (in-app list + push notification). Atomic accept.
- Tap-to-call between shop and driver.
- Live driver location for the shop. Public tracking link for the recipient.
- Pickup QR + photo, delivery code + photo, POD PDF.
- Two-way ratings, simple driver score.
- Price: platform-suggested fixed price by distance and vehicle class (Q-01), paid by the shop
  directly to the driver (cash or mobile money).
- **Driver wallet** (prepaid, platform fees only): top up via mobile money, commission set aside
  at accept and charged at delivery. No balance, no jobs. See §6.
- Anti-spoofing: block checkpoints when a fake-GPS app is active, device integrity check, server-side
  plausibility checks on the GPS trail (see §8).
- Ops dashboard: approve drivers, live map of active jobs, cancel/reassign, view audit log,
  wallet balances and manual adjustments, fraud signals.
- Swahili and English.

### Phase 2: money and efficiency
- In-app mobile money payments via a local aggregator (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa).
- Shop pays the platform in-app; the platform pays drivers out (driver earnings become withdrawable).
  The Phase 1 commission wallet stays for any jobs still paid in cash.
- Cash-on-delivery collection on behalf of the shop (Q-05), if we decide to offer it.
- ETA from a self-hosted routing engine on Tanzania map data.
- Scheduled deliveries, and saved addresses and recipients.
- Number masking for calls (so drivers and shops don't need each other's real numbers).
- Monthly invoicing for business accounts.

### Phase 3: scale
- Multi-stop routes (one canter, several drops).
- Batched deliveries and smarter dispatch (auto-assign instead of broadcast).
- Inter-city legs, starting with Dar ↔ Morogoro / Dodoma / Arusha.
- Partner API so e-commerce sites can create deliveries automatically.
- New cities: Arusha, Mwanza, Dodoma, Mbeya.

## 6. How the platform earns in Phase 1: the driver wallet

In Phase 1 the shop pays the driver directly, so the platform never touches the delivery fee. To
still collect commission, each driver has a **prepaid wallet** used only for platform fees. This is
the same model Bolt and Uber use in cash-heavy markets.

1. **Top up.** The driver sends mobile money to the platform (through the payment aggregator's
   reference or USSD push, or to a till number reconciled by ops during the pilot). The deposit is
   credited to the wallet.
2. **Accept.** The commission for that specific job is calculated and **set aside** (held) from the
   wallet in the same database transaction as the accept. If the available balance can't cover it,
   the accept is refused with "top up to take this job". A fixed minimum balance doesn't work:
   commission on a canter job can be several times the commission on a boda job.
3. **Deliver.** The held amount is **charged**: it becomes a permanent ledger entry.
4. **Cancel / fail.** The hold is **released**, or partly charged, per the cancellation rules (Q-07).
5. **No balance, no jobs.** A driver whose available balance is below the smallest commission for
   their vehicle class doesn't receive offers. The app shows the balance and a top-up button.

Rules that keep the money correct (details in ARCHITECTURE.md §6.4 and §7):
- Every money movement is an append-only ledger entry; nothing is edited or deleted.
- A delivery can be charged commission **once**, enforced by the database, not just by the code.
- A deposit is credited once per payment-provider reference, so a repeated callback can't double it.
- The wallet balance never goes negative.
- The balance cannot be withdrawn as cash, only spent on platform fees (refund policy and
  regulatory status: Q-35, Q-36).

## 7. Things that are specific to Tanzania

| Topic | What we do about it |
|---|---|
| **Addresses** | The map pin is the address. Plus a free-text landmark ("opposite Mlimani City, blue gate") and the recipient's phone. Driver can call the recipient from the app. OpenStreetMap coverage of Dar is strong thanks to the Ramani Huria project, so free maps are viable. |
| **Finding the pickup** | Every pickup location has a required storefront photo, shown in the driver app next to the landmark text, so the driver knows which building or gate to look for. Stored per pickup location, not per shop, because many shops (especially in Kariakoo) load from a godown that isn't the storefront. Same idea for saved drop-off addresses later. |
| **Connectivity** | The driver app keeps working offline: queues location points and actions locally and syncs when back online. Small payloads to save bundles. |
| **Devices** | Target cheap Android phones with ~2–3 GB RAM. Keep the app small. The shop app is a web app so no install is needed. |
| **Payments** | Mobile money first, through a licensed aggregator (Selcom, AzamPay, ClickPesa, etc.: Q-19). In the MVP the shop pays the driver directly; drivers top up their platform wallet with mobile money (§6). |
| **Language** | Swahili first, English second. All SMS in Swahili by default. |
| **Sharing** | The tracking link will mostly travel over WhatsApp. It must load fast on a weak 3G connection with no login. |
| **SMS** | Login codes and delivery codes via a local SMS gateway (Beem Africa, Africa's Talking, etc.: Q-20). Register a sender ID. |
| **Driver vetting** | NIDA number, driving licence, vehicle registration, photo, next of kin, ideally a guarantor and a LATRA licence where required (Q-14, Q-15). |
| **Data protection** | Tanzania's Personal Data Protection Act (2022) applies: register with the Personal Data Protection Commission, minimise location retention, publish a privacy notice. (Q-25) |
| **Tax / receipts** | Platform fees likely need TRA-compliant receipts (EFD/VFD). Confirm with an accountant before charging in-app (Q-24). |

## 8. Trust and safety: the real moat

Theft and fraud kill marketplaces like this faster than bad code. Built in from day one:
- Ops approves every driver manually in MVP; no self-serve go-live.
- **Declared-value cap per driver tier.** New drivers can only take low-value goods; the cap rises
  with completed deliveries and rating (Q-08).
- QR at pickup and code at delivery. Photos at both ends. GPS stamped on every checkpoint.
- Off-route and stopped-too-long alerts to ops during a job.
- **Fake-GPS blocking.** The driver app reads Android's mock-location flag on every fix. If a
  fake-GPS app is active, the app blocks the "at pickup", "picked up", "at drop-off" and "delivered"
  actions and asks the driver to turn it off. The API rejects these calls too if the attached
  fix is marked as mock. This is easy to hide on a rooted phone, so it is one signal, not a
  guarantee:
  - **Device integrity check** (Google Play Integrity) at login and at accept. Rooted or tampered
    phones are flagged; policy for blocking vs reviewing is Q-37.
  - **Server-side plausibility checks** on every GPS trail: impossible speeds, jumps across town
    between consecutive points, a trail that doesn't connect pickup and drop-off. Findings go to ops
    as fraud signals.
  - Note that fake GPS alone can't complete a delivery: pickup needs the QR scan and delivery needs
    the recipient's code. The real risk is a driver faking an on-route position while detouring
    with the goods, which is what the trail checks catch.
- **Driver wallet gating.** No balance, no offers (§6). Drivers with outstanding disputes can be
  frozen by ops.
- **SMS abuse protection.** Login and delivery-code SMS are rate-limited per phone number, per IP
  and per number prefix, so bots can't burn the SMS budget ("SMS pumping").
- Ratings both ways; automatic review below a threshold.
- An emergency "report a problem" button for driver and shop.

## 9. Success measures for the MVP

- Time from post to accept: **median < 5 minutes**.
- Share of deliveries completed with a valid code: **> 95%**.
- Shop sees driver position within **2 seconds** of the driver's phone sending it.
- Repeat shops: **> 60%** of shops post again within 2 weeks.
- Driver earnings per online hour that are competitive with street work (needs Phase 0 data).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Not enough drivers online when shops post (cold start) | Launch in a few dense zones (Kariakoo, Posta, Mikocheni, Sinza), recruit drivers before shops, guarantee minimum earnings in the first weeks if budget allows |
| Goods theft or fraud | Section 8 |
| Drivers and shops take repeat business off-platform | Value they can't get alone: POD, tracking link, payments, insurance, steady flow of new jobs |
| Android kills background location | Foreground service with a persistent notification while on a job; guided battery-optimisation exemption on onboarding; tested on popular low-end brands |
| Regulatory surprise (LATRA, TRA, PDPC) | Get a legal opinion during Phase 0 (Q-15, Q-24, Q-25) |
| Cost of SMS | Use SMS only where it matters (login, delivery code); push notifications and in-app for everything else; rate limits against SMS pumping (§8) |
| Drivers find topping up the wallet annoying | Small minimum top-up, USSD push from inside the app, show "jobs you could take with this balance"; launch bonus credit for the first drivers |
