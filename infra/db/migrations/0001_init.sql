-- MzigoFasta: initial schema. See docs/ARCHITECTURE.md §7.
--
-- Conventions
--   * Money is TZS in integer columns (bigint). Shilling has no minor unit in practice.
--   * Points are PostGIS geography(Point, 4326).
--   * Rules that protect money or evidence are enforced here, not only in the API:
--     append-only tables, one commission per delivery, wallets that can't go negative.
--   * Row-level security is ON for every table with no policies. Our API connects with a
--     privileged role; on Supabase this blocks the auto-generated public REST API from reading
--     anything, which is what we want until we deliberately expose something.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type vehicle_class as enum ('boda', 'bajaji', 'car', 'pickup', 'canter');

create type delivery_status as enum (
  'OPEN', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CLOSED',
  'EXPIRED', 'CANCELLED', 'RETURNING', 'RETURNED'
);

create type driver_status as enum ('pending', 'approved', 'suspended');

create type shop_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function forbid_update_delete() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'restrict_violation';
end $$;

-- ---------------------------------------------------------------------------
-- People and shops
-- ---------------------------------------------------------------------------

-- One row per authenticated person. id = the auth provider's user id (Supabase auth.users.id).
create table users (
  id          uuid primary key,
  phone       text unique,
  full_name   text,
  is_ops      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table shops (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 2 and 120),
  phone         text not null,
  tin           text,
  status        text not null default 'active' check (status in ('active', 'suspended')),
  rating_avg    numeric(3, 2),
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Staff are invited by phone number; user_id is filled in when that person first signs in.
create table shop_members (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops on delete cascade,
  user_id     uuid references users,
  phone       text not null,
  role        shop_role not null,
  created_at  timestamptz not null default now(),
  unique (shop_id, phone)
);
create index shop_members_user on shop_members (user_id);
create index shop_members_pending_phone on shop_members (phone) where user_id is null;

-- Files in R2 (photos, signatures, documents). Checkpoints reference these by id.
create table uploads (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references users,
  kind           text not null check (kind in (
                   'storefront_photo', 'pickup_photo', 'dropoff_photo', 'signature',
                   'driver_document', 'vehicle_photo')),
  r2_key         text not null unique,
  content_type   text not null,
  size_bytes     integer not null check (size_bytes > 0),
  sha256         text not null,
  delivery_id    uuid,  -- set when attached to a delivery checkpoint; FK added below
  created_at     timestamptz not null default now()
);

-- Where goods are collected. A shop may have several (storefront, godown, ...).
create table pickup_locations (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references shops on delete cascade,
  name                 text not null,
  pin                  geography(Point, 4326) not null,
  landmark             text,
  storefront_photo_id  uuid not null references uploads,
  is_default           boolean not null default false,
  archived_at          timestamptz,
  created_at           timestamptz not null default now()
);
create unique index pickup_locations_one_default on pickup_locations (shop_id)
  where is_default and archived_at is null;

-- ---------------------------------------------------------------------------
-- Drivers
-- ---------------------------------------------------------------------------

-- The most a driver of each tier may carry in declared value (docs/PLAN.md §8, Q-08).
create table driver_tiers (
  tier                    smallint primary key,
  name                    text not null,
  max_declared_value_tzs  bigint not null check (max_declared_value_tzs > 0)
);

create table drivers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references users,
  full_name     text not null,
  nida_no       text not null unique,
  licence_no    text not null,
  status        driver_status not null default 'pending',
  tier          smallint not null default 1 references driver_tiers,
  rating_avg    numeric(3, 2),
  rating_count  integer not null default 0,
  approved_at   timestamptz,
  approved_by   uuid references users,
  created_at    timestamptz not null default now()
);

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references drivers on delete cascade,
  class        vehicle_class not null,
  plate        text not null unique,
  capacity_kg  integer check (capacity_kg > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index vehicles_driver on vehicles (driver_id) where active;

-- ---------------------------------------------------------------------------
-- Pricing (Q-01, Q-02). Values are seeded as placeholders in 0002.
-- ---------------------------------------------------------------------------

create table pricing_rules (
  vehicle_class       vehicle_class primary key,
  base_tzs            integer not null check (base_tzs >= 0),
  per_km_tzs          integer not null check (per_km_tzs >= 0),
  min_price_tzs       integer not null check (min_price_tzs > 0),
  commission_pct      numeric(5, 2) not null check (commission_pct between 0 and 100),
  commission_min_tzs  integer not null check (commission_min_tzs >= 0),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------------

create table deliveries (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references shops,
  pickup_location_id  uuid not null references pickup_locations,
  driver_id           uuid references drivers,
  vehicle_class       vehicle_class not null,
  status              delivery_status not null default 'OPEN',

  pickup_pin          geography(Point, 4326) not null,
  pickup_landmark     text,
  dropoff_pin         geography(Point, 4326) not null,
  dropoff_landmark    text,
  recipient_name      text not null,
  recipient_phone     text not null,
  goods_description   text not null,
  declared_value_tzs  bigint not null check (declared_value_tzs >= 0),

  distance_km         numeric(7, 2) not null check (distance_km >= 0),
  price_tzs           integer not null check (price_tzs > 0),
  tip_tzs             integer not null default 0 check (tip_tzs >= 0),
  -- Fixed when a driver accepts, so later pricing changes can't alter an accepted job.
  commission_tzs      integer check (commission_tzs >= 0),

  -- HMAC of the 4-digit code the recipient gives the driver. Set at pickup.
  code_hash           text,
  code_attempts       smallint not null default 0,
  code_sends          smallint not null default 0,

  offer_expires_at    timestamptz not null,
  posted_by           uuid not null references users,
  posted_at           timestamptz not null default now(),
  accepted_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  updated_at          timestamptz not null default now(),

  constraint driver_present_when_assigned check (
    status in ('OPEN', 'EXPIRED', 'CANCELLED') or driver_id is not null
  )
);
create trigger deliveries_touch before update on deliveries
  for each row execute function touch_updated_at();
create index deliveries_open_pickup on deliveries using gist (pickup_pin) where status = 'OPEN';
create index deliveries_open_expiry on deliveries (offer_expires_at) where status = 'OPEN';
create index deliveries_shop on deliveries (shop_id, posted_at desc);
create index deliveries_driver on deliveries (driver_id, posted_at desc);
-- MVP rule: a driver carries one delivery at a time.
create unique index deliveries_one_active_per_driver on deliveries (driver_id)
  where status in ('ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'RETURNING');

alter table uploads
  add constraint uploads_delivery_fk foreign key (delivery_id) references deliveries;

-- Every status change, with who, when and where. The audit trail for disputes.
create table delivery_events (
  id             bigint generated always as identity primary key,
  delivery_id    uuid not null references deliveries,
  action         text not null,  -- 'post' or a DeliveryAction from @mzigo/contracts
  from_status    delivery_status,
  to_status      delivery_status not null,
  actor_role     text not null check (actor_role in ('shop', 'driver', 'ops', 'system')),
  actor_user_id  uuid references users,
  at             timestamptz not null default now(),
  device_at      timestamptz,
  pin            geography(Point, 4326),
  payload        jsonb not null default '{}',
  -- Evidence about the device at a checkpoint: mock flag, integrity verdict, app version.
  integrity      jsonb
);
create index delivery_events_delivery on delivery_events (delivery_id, id);
create trigger delivery_events_append_only before update or delete on delivery_events
  for each row execute function forbid_update_delete();

-- Unguessable links the shop shares with its customer. The bridge refreshes `snapshot`.
create table public_links (
  token        text primary key check (length(token) >= 22),
  delivery_id  uuid not null unique references deliveries,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,  -- set when the delivery finishes
  snapshot     jsonb,
  snapshot_at  timestamptz
);

create table ratings (
  id            uuid primary key default gen_random_uuid(),
  delivery_id   uuid not null references deliveries,
  from_role     text not null check (from_role in ('shop', 'driver')),
  from_user_id  uuid not null references users,
  stars         smallint not null check (stars between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  unique (delivery_id, from_role)
);

-- ---------------------------------------------------------------------------
-- Location plane storage (written by the bridge)
-- ---------------------------------------------------------------------------

create table location_points (
  delivery_id  uuid not null,
  seq          integer not null,
  t            timestamptz not null,
  pin          geography(Point, 4326) not null,
  acc          real,
  spd          real,
  hdg          real,
  bat          smallint,
  mock         boolean not null default false,
  received_at  timestamptz not null default now(),
  primary key (delivery_id, t, seq)
) partition by range (t);

create table location_points_default partition of location_points default;

-- Creates monthly partitions for this month and the next `months_ahead`. The bridge calls it daily.
create function ensure_location_partitions(months_ahead integer default 1) returns void
language plpgsql as $$
declare
  m date;
  name text;
begin
  for i in 0..months_ahead loop
    m := (date_trunc('month', now()) + make_interval(months => i))::date;
    name := format('location_points_%s', to_char(m, 'YYYY_MM'));
    if to_regclass(name) is null then
      execute format(
        'create table %I partition of location_points for values from (%L) to (%L)',
        name, m, (m + interval '1 month')::date);
      execute format('alter table %I enable row level security', name);
    end if;
  end loop;
end $$;
select ensure_location_partitions(1);

create table delivery_latest (
  delivery_id  uuid primary key references deliveries,
  pin          geography(Point, 4326) not null,
  t            timestamptz not null,
  spd          real,
  hdg          real,
  mock         boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table driver_presence (
  driver_id   uuid primary key references drivers,
  pin         geography(Point, 4326),
  online      boolean not null,
  t           timestamptz,
  mock        boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index driver_presence_online on driver_presence using gist (pin) where online;

create table fraud_signals (
  id           bigint generated always as identity primary key,
  driver_id    uuid not null references drivers,
  delivery_id  uuid references deliveries,
  kind         text not null check (kind in (
                 'mock_location', 'impossible_speed', 'integrity_failed', 'code_attempts_exhausted')),
  at           timestamptz not null default now(),
  details      jsonb not null default '{}',
  reviewed_by  uuid references users,
  reviewed_at  timestamptz,
  outcome      text
);
create index fraud_signals_unreviewed on fraud_signals (at desc) where reviewed_at is null;
create index fraud_signals_driver on fraud_signals (driver_id, at desc);

-- ---------------------------------------------------------------------------
-- Outbox: events the bridge publishes to MQTT after the transaction commits.
-- ---------------------------------------------------------------------------

create table outbox (
  id            bigint generated always as identity primary key,
  topic         text not null,
  payload       jsonb,  -- null = an empty message, which clears a retained topic
  qos           smallint not null default 1 check (qos in (0, 1)),
  retain        boolean not null default false,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index outbox_unpublished on outbox (id) where published_at is null;

create function outbox_notify() returns trigger language plpgsql as $$
begin
  perform pg_notify('outbox', '');
  return null;
end $$;
create trigger outbox_notify after insert on outbox
  for each statement execute function outbox_notify();

-- ---------------------------------------------------------------------------
-- Driver wallet (docs/PLAN.md §6, ARCHITECTURE.md §6.4)
--
-- ledger_entries are the truth. driver_wallets is a cached total kept in step by triggers in the
-- same transaction, so application code only ever inserts ledger entries and holds.
-- ---------------------------------------------------------------------------

create table driver_wallets (
  driver_id    uuid primary key references drivers,
  balance_tzs  bigint not null default 0,
  held_tzs     bigint not null default 0 check (held_tzs >= 0),
  updated_at   timestamptz not null default now(),
  constraint wallet_never_negative check (balance_tzs - held_tzs >= 0)
);

create function create_driver_wallet() returns trigger language plpgsql as $$
begin
  insert into driver_wallets (driver_id) values (new.id);
  return new;
end $$;
create trigger drivers_wallet after insert on drivers
  for each row execute function create_driver_wallet();

create table ledger_entries (
  id            bigint generated always as identity primary key,
  driver_id     uuid not null references drivers,
  amount_tzs    bigint not null check (amount_tzs <> 0),
  type          text not null check (type in ('deposit', 'commission', 'adjustment', 'refund', 'bonus')),
  delivery_id   uuid references deliveries,
  external_ref  text,          -- payment provider reference for deposits
  created_by    uuid references users,  -- null = system
  note          text,
  created_at    timestamptz not null default now(),
  constraint commission_shape check (type <> 'commission' or (delivery_id is not null and amount_tzs < 0)),
  constraint deposit_shape check (type <> 'deposit' or (external_ref is not null and amount_tzs > 0)),
  constraint adjustment_has_reason check (type <> 'adjustment' or (created_by is not null and note is not null))
);
-- A delivery is charged commission once, and a payment is credited once, whatever retries happen.
create unique index ledger_one_commission_per_delivery on ledger_entries (delivery_id) where type = 'commission';
create unique index ledger_one_credit_per_external_ref on ledger_entries (external_ref) where external_ref is not null;
create index ledger_driver on ledger_entries (driver_id, id desc);
create trigger ledger_append_only before update or delete on ledger_entries
  for each row execute function forbid_update_delete();

create function ledger_apply() returns trigger language plpgsql as $$
begin
  update driver_wallets
     set balance_tzs = balance_tzs + new.amount_tzs, updated_at = now()
   where driver_id = new.driver_id;
  return new;
end $$;
create trigger ledger_apply after insert on ledger_entries
  for each row execute function ledger_apply();

create table wallet_holds (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references drivers,
  delivery_id  uuid not null references deliveries,
  amount_tzs   bigint not null check (amount_tzs > 0),
  status       text not null default 'held' check (status in ('held', 'captured', 'released')),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);
-- A delivery can be released and re-accepted by another driver, so only one *open* hold per delivery.
create unique index wallet_holds_one_open_per_delivery on wallet_holds (delivery_id) where status = 'held';

create function wallet_holds_apply() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'held' then
      raise exception 'holds must be created as held';
    end if;
    update driver_wallets
       set held_tzs = held_tzs + new.amount_tzs, updated_at = now()
     where driver_id = new.driver_id;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'held' or new.status = 'held'
       or new.amount_tzs <> old.amount_tzs or new.driver_id <> old.driver_id
       or new.delivery_id <> old.delivery_id then
      raise exception 'a hold can only move once, from held to captured or released';
    end if;
    update driver_wallets
       set held_tzs = held_tzs - old.amount_tzs, updated_at = now()
     where driver_id = old.driver_id;
  else
    raise exception 'holds cannot be deleted';
  end if;
  return new;
end $$;
create trigger wallet_holds_apply after insert or update or delete on wallet_holds
  for each row execute function wallet_holds_apply();

-- Should always be empty. Anything here means the cached totals drifted from the ledger.
create view wallet_drift as
select w.driver_id,
       w.balance_tzs as cached_balance,
       coalesce(l.sum, 0) as ledger_balance,
       w.held_tzs as cached_held,
       coalesce(h.sum, 0) as open_holds
  from driver_wallets w
  left join (select driver_id, sum(amount_tzs) as sum from ledger_entries group by driver_id) l using (driver_id)
  left join (select driver_id, sum(amount_tzs) as sum from wallet_holds where status = 'held' group by driver_id) h using (driver_id)
 where w.balance_tzs <> coalesce(l.sum, 0) or w.held_tzs <> coalesce(h.sum, 0);

-- ---------------------------------------------------------------------------
-- Row-level security: on everywhere, no policies (see header).
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys' loop
    execute format('alter table %I enable row level security', r.tablename);
  end loop;
end $$;
