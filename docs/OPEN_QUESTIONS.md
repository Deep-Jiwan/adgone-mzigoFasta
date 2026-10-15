# Open questions

Every decision we still need to make, each with a suggested default so we can move forward even
if a question stays open. Fill in **Answer** as decisions are made.

- **Blocking**: needed before we design that part in detail.
- **Before launch**: can wait until MVP is built, but not until launch.
- **Later**: Phase 2 or after.

| IDs | Topic | Priority |
|---|---|---|
| Q-01 – Q-13, Q-35, Q-38 | [Business model and product](#business-model-and-product) | mostly blocking |
| Q-14 – Q-18, Q-36, Q-37 | [Operations, trust and legal](#operations-trust-and-legal) | before launch |
| Q-19 – Q-25 | [Integrations and data](#integrations-and-data) | mixed |
| Q-26 – Q-31 | [Technical choices](#technical-choices) | blocking for build |
| Q-32 – Q-34 | [Project](#project) | blocking |

IDs never change once assigned, so questions added later sit in their topic with a higher number.

---

## Business model and product

### Q-01 · How is the price of a delivery set? · Blocking
- **Options:** (a) platform sets a fixed price from distance + vehicle class, like Bolt; (b) shop
  offers a price, drivers accept or ignore; (c) drivers bid and the shop picks.
- **Why it matters:** changes the posting screen, the matching logic and how fast jobs are accepted.
- **Suggested default:** (a) platform price, with the shop allowed to add a tip to attract drivers
  faster. Simple, fast and predictable for shops.
- **Answer:** **Answered:** the pricing model is not hard-coded; it is a platform setting (platform fixed price, shop offer, or bidding) that an admin can change. Default value in settings: platform fixed price from distance + vehicle class, with optional shop tip.

### Q-02 · How does the platform make money? · Blocking
- **Options:** commission per delivery (e.g. 10–20% of the price), monthly subscription for shops,
  or both.
- **Decided mechanism:** in Phase 1 commission is collected from a prepaid driver wallet (PLAN.md
  §6), because the shop pays the driver directly. Still open: the commission rate, and whether it's a
  percentage, a fixed fee per vehicle class, or both.
- **Suggested default:** commission per delivery. Optional subscription later for high-volume shops
  (lower commission, invoicing, priority).
- **Answer:** **Answered:** the revenue model is not hard-coded; commission rate/type (percentage, fixed fee per vehicle class) and any subscription are platform settings an admin can change.

### Q-03 · Who are the drivers? · Blocking
- **Options:** independent drivers who sign up (like Bolt); partnerships with existing boda groups,
  bajaji owners and canter fleets; or both.
- **Why it matters:** fleets bring many vehicles at once but need a "fleet owner" account that
  manages several drivers and receives the money.
- **Suggested default:** independent drivers for MVP, design the data model so a fleet owner
  account can be added in Phase 2.
- **Answer:**

### Q-04 · Who pays, and when? · Blocking
- **Options:** shop pays per job at posting / at delivery; shop tops up a prepaid wallet; recipient
  pays the delivery fee.
- **Suggested default:** shop pays. MVP: shop pays the driver directly (cash / mobile money),
  recorded in the app; the platform's commission comes from the driver wallet. Phase 2: prepaid
  shop wallet charged automatically on delivery, platform pays drivers out.
- **Answer:**

### Q-05 · Will drivers collect cash on delivery for the shop? · Later, but decide direction now
- **Context:** very common in Tanzania (customer pays for the goods at the door). Huge value to
  shops, but it puts real money in the driver's hands and needs reconciliation.
- **Suggested default:** not in MVP. Phase 2 with mobile-money collection to the shop directly
  (customer pays the shop's number while the driver waits), not cash.
- **Answer:**

### Q-06 · How and when are drivers paid? · Later
- **Suggested default:** MVP drivers are paid directly by the shop (the Phase 1 driver wallet only
  holds platform fees and can't be withdrawn). Phase 2: earnings collected by the platform, daily
  payout to the driver's mobile money.
- **Answer:**

### Q-07 · Cancellation rules · Before launch
- **Questions:** can the shop cancel after a driver accepted? A fee if the driver already reached
  the shop? What happens when drivers cancel often?
- **Suggested default:** free cancel within 2 min of accept; after that a small fee to the driver
  if they're already near pickup. Driver cancellations lower their priority for new offers.
- **Answer:**

### Q-08 · Value of goods: caps and insurance · Before launch
- **Questions:** maximum declared value per delivery? Per driver tier? Do we offer goods-in-transit
  insurance (partner with an insurer)? Who is liable if goods are lost?
- **Suggested default:** caps by tier, e.g. new drivers ≤ TZS 300,000; raised with completed jobs
  and rating. Higher-value jobs only to top-tier drivers. Explore insurance in Phase 2.
- **Answer:**

### Q-09 · Which vehicle classes at launch? · Blocking
- **Options:** boda (motorbike), bajaji (tuk-tuk), car, pickup (kirikuu / small truck), canter,
  bigger trucks.
- **Suggested default:** boda, bajaji, pickup, canter. Each with a simple size/weight guide shown
  to the shop when posting.
- **Answer:** **Answered:** boda, bajaji and pickup (kirikuu) at launch. Canter is left out of the first release.

### Q-10 · Launch area and hours · Blocking
- **Suggested default:** a few dense commercial zones first (Kariakoo, Posta/City Centre,
  Mikocheni, Sinza, Mwenge), 07:00–20:00, then all of Dar.
- **Answer:**

### Q-11 · Product name and brand · Before launch
- **Context:** the repo is called `adgone-mzigoFasta`. Is the product **MzigoFasta**, and is
  "adgone" the company?
- **Answer:**

### Q-12 · Recipient experience · Blocking
- **Questions:** is the delivery code always sent by SMS to the recipient? What if the recipient
  is not the person at the door (gate guard, receptionist)? Can the shop give the code instead?
- **Suggested default:** SMS to the recipient phone; the recipient can forward it to whoever is at
  the door. Fallback: the shop can read the code to the driver over the phone, logged as "code
  provided by shop".
- **Answer:**

### Q-13 · Ratings rules · Before launch
- **Questions:** what happens below a rating threshold? Can shops mark favourite drivers who get
  their jobs first? Can drivers see a shop's rating before accepting?
- **Suggested default:** drivers below 4.2 after 20 jobs are reviewed by ops. Favourite drivers
  get a 60-second head start on that shop's offers. Drivers see shop rating.
- **Answer:**

### Q-35 · Driver wallet rules · Blocking
- **Questions:** minimum top-up amount? Launch bonus credit for early drivers? Can a driver get the
  remaining balance back when they leave the platform? Do commission holds get partly charged on
  late cancellations (ties to Q-07)?
- **Suggested default:** minimum top-up TZS 2,000; TZS 10,000 launch credit for the first 100
  approved drivers; balance refundable on request when leaving (minus any open disputes); late
  cancellations by the driver charge the full hold, by the shop release it.
- **Answer:**

### Q-38 · Can a driver carry more than one delivery at a time? · Before launch
- **Context:** the backend currently allows one active delivery per driver (enforced in the
  database). A boda rider could often carry two small parcels going the same way.
- **Suggested default:** one at a time for the pilot; revisit with multi-stop routes in Phase 3.
- **Answer:**

## Operations, trust and legal

### Q-14 · Driver onboarding requirements · Before launch
- **Suggested default:** NIDA number, driving licence, vehicle registration card, selfie, vehicle
  photos, next of kin. Guarantor letter for higher tiers. In-person verification day for first
  batch.
- **Answer:**

### Q-15 · LATRA and transport licensing · Before launch
- **Questions:** does the platform need a LATRA licence as a goods-transport aggregator? Do drivers
  need their own commercial permits (especially pickups and canters)?
- **Suggested default:** get a legal opinion in Phase 0.
- **Answer:**

### Q-16 · Shop onboarding · Before launch
- **Questions:** anyone can sign up, or do we verify the business (TIN, business licence, physical
  visit)?
- **Suggested default:** phone sign-up is enough to post low-value jobs; verified badge (TIN +
  licence) unlocks higher values and invoicing.
- **Answer:**

### Q-17 · Support and disputes · Before launch
- **Questions:** who handles "goods damaged/missing", and through which channel?
- **Suggested default:** a WhatsApp Business support line plus the in-app "report a problem",
  resolved by ops using the audit log, photos and GPS trail.
- **Answer:**

### Q-18 · Prohibited goods · Before launch
- **Suggested default:** a published list (cash, weapons, drugs, hazardous chemicals, live animals,
  etc.) that shops accept when signing up. Drivers can refuse at pickup without penalty.
- **Answer:**

### Q-36 · Is a prepaid driver wallet regulated? · Before launch
- **Question:** does holding drivers' prepaid balances count as e-money or another activity the
  Bank of Tanzania regulates? Does it change if the balance is refundable (Q-35)?
- **Suggested default:** keep it closed-loop (only spendable on platform fees, not transferable);
  get a legal opinion in Phase 0 together with Q-15, Q-24 and Q-25.
- **Answer:**

### Q-37 · Rooted phones and fake GPS: block or review? · Before launch
- **Questions:** if the device integrity check fails (rooted or tampered phone), do we block the
  driver from going online, or allow it and send their jobs to ops review? How many fake-GPS
  detections before suspension?
- **Suggested default:** mock location active → checkpoints blocked until it's turned off (always).
  Failed integrity → allowed for low-value jobs only, flagged to ops. Three confirmed spoofing
  signals → suspended pending review.
- **Answer:**

## Integrations and data

### Q-19 · Mobile money aggregator · Blocking (driver wallet top-ups in Phase 1)
- **Options:** Selcom, AzamPay, ClickPesa, DPO, or direct integration with each mobile network.
- **Why it's now needed in Phase 1:** drivers top up their wallet (PLAN.md §6). Phase 1 only
  needs **collection** (money in); payouts (money out) come in Phase 2.
- **Suggested default:** one aggregator covering M-Pesa, Mixx by Yas, Airtel Money and HaloPesa,
  chosen on fees, USSD push support, payout (disbursement) support and API quality. For a very
  small pilot, a till number reconciled manually by ops is an acceptable stopgap.
- **Answer:**

### Q-20 · SMS gateway · Blocking (login needs it)
- **Options:** Beem Africa, Africa's Talking, NextSMS, Twilio.
- **Suggested default:** a local gateway (cheaper, local sender ID). Must work with the auth
  provider's phone login. Prefer one that supports spend caps and alerts, as a second line of
  defence against SMS pumping (ARCHITECTURE.md §3.1).
- **Answer:**

### Q-21 · Maps · Blocking
- **Options:** Google Maps (best search for places, paid per use) or OpenStreetMap-based tiles with
  MapLibre (free / cheap, very good coverage of Dar).
- **Suggested default:** OpenStreetMap + MapLibre for displaying maps; Google only for place search
  if OSM search proves weak. Navigation opens Google Maps / Waze on the driver's phone.
- **Answer:**

### Q-22 · How long do we keep location history? · Before launch
- **Suggested default:** full GPS trail for 90 days (dispute window); after that keep only
  checkpoints (pickup, delivery) and a simplified route line.
- **Answer:**

### Q-23 · Public tracking link details · Blocking
- **Questions:** refresh interval (you said 5 min, OK to go faster?), what is shown (driver first
  name? photo? plate?), when does the link expire?
- **Suggested default:** refresh every 5 min, configurable down to 1 min later. Show driver first
  name, vehicle class, partial plate, status, ETA, position. No phone number. Link stops showing
  position at delivery and expires 24 h later.
- **Answer:**

### Q-24 · TRA receipts · Before charging in-app
- **Question:** do our fees need EFD/VFD receipts, and do drivers' earnings need anything?
- **Suggested default:** ask an accountant in Phase 0.
- **Answer:**

### Q-25 · Data protection · Before launch
- **Question:** register with the Personal Data Protection Commission as a data controller? Where
  may we store data (outside Tanzania OK)?
- **Suggested default:** legal check in Phase 0; privacy notice in Swahili and English.
- **Answer:**

## Technical choices

### Q-26 · MQTT broker: where does it run? · Blocking for build
- **Options:** (a) self-host EMQX + bridge on one VPS with Docker; (b) managed MQTT (EMQX Cloud,
  HiveMQ Cloud, AWS IoT Core) + bridge on a small container host; (c) skip MQTT and use the
  all-Cloudflare Durable Objects design (ARCHITECTURE.md §10).
- **Note:** check EMQX's current licence terms for our size. Mosquitto, NanoMQ and VerneMQ are
  fully open alternatives (with fewer features).
- **Suggested default:** (a) for the MVP. Cheapest and fully under our control. Move to managed if
  ops work becomes a burden.
- **Answer:** _Not confirmed. The backend is built with the suggested default for now._

### Q-27 · Where does the API run? · Blocking for build
- **Options:** Cloudflare Workers (serverless) or a Node service on the same VPS as the broker.
- **Suggested default:** Cloudflare Workers.
- **Answer:** _Not confirmed. The backend is built with the suggested default for now._

### Q-28 · Which Postgres? · Blocking for build
- **Options:** Supabase (Postgres + PostGIS + phone auth), Neon (+ Cloudflare Hyperdrive), or
  self-hosted on the VPS.
- **Suggested default:** Supabase. One provider for database and phone auth, PostGIS included.
- **Answer:** _Not confirmed. The backend is built with the suggested default for now._

### Q-29 · Driver app framework and language · Blocking for build
- **Options:** React Native (Expo) in TypeScript, or Flutter (Dart).
- **Why it matters:** reliable background location on cheap Android phones is the hardest
  mobile part. Both have good (sometimes paid) background-location libraries.
- **Suggested default:** React Native + Expo in **TypeScript**, so the driver app, web apps, API
  and bridge all share `packages/contracts`.
- **Answer:**

### Q-30 · Shop app: web only, or native too? · Later
- **Suggested default:** web app (installable as a PWA) for MVP. Native later if shops ask for it.
- **Answer:**

### Q-31 · Location update rate · Before launch
- **Suggested default:** on a job every 10 s or 50 m; idle every 60–120 s (ARCHITECTURE.md §4.4).
  Tune after field tests for battery and data use.
- **Answer:**

## Project

### Q-32 · Monthly infrastructure budget · Blocking
- **Context:** MVP infrastructure can run on roughly USD 20–60/month (VPS + database + SMS
  credits). SMS will likely be the biggest variable cost.
- **Answer:**

### Q-33 · Target date for MVP / pilot · Blocking
- **Answer:**

### Q-34 · Team · Blocking
- **Questions:** who builds (just you, or more developers)? Who handles driver recruitment and
  ops during the pilot?
- **Answer:**
