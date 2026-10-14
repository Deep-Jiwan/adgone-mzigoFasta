-- Reference data.
--
-- PLACEHOLDER VALUES. Prices, commission and tier caps are guesses so the system runs end to end.
-- Replace them with figures from Phase 0 interviews (docs/OPEN_QUESTIONS.md Q-01, Q-02, Q-08)
-- before any real delivery. They live in tables, not code, so changing them needs no deploy.

insert into driver_tiers (tier, name, max_declared_value_tzs) values
  (1, 'New',       300000),
  (2, 'Trusted',  1500000),
  (3, 'Top',     10000000);

insert into pricing_rules (vehicle_class, base_tzs, per_km_tzs, min_price_tzs, commission_pct, commission_min_tzs) values
  ('boda',    2000,  500,  3000, 15, 300),
  ('bajaji',  3000,  700,  4000, 15, 500),
  ('car',     5000, 1000,  7000, 15, 1000),
  ('pickup', 15000, 2000, 20000, 12, 2000),
  ('canter', 30000, 3000, 40000, 10, 4000);
