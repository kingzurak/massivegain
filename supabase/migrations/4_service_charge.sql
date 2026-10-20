-- 4_service_charge
--
-- Let an admin set what WE charge on top of the provider's cost, per service,
-- with a global default — so the sell price can be derived instead of typed,
-- and an order can never be placed at a loss.
--
-- The model, in NGN per 1,000:
--
--   cost   = services.provider_rate            (what bestclout charges us)
--   pct    = services.charge_percent  ?? global bestclout_markup_percent
--   flat   = services.charge_flat     ?? global default_charge_flat
--   price  = round(cost * (1 + pct/100) + flat, 2)   -> price_per_thousand
--   charge = price - cost                            (our money)
--
--   The % and the flat fee compose: both apply when both are set. A service
--   with no known cost (provider_rate is null — manually fulfilled services)
--   keeps a hand-entered price; the charge columns are inert for it.
--
-- price_per_thousand stays a stored column and stays the single number the
-- money path uses, so place_order() and everything it guards are unchanged.
-- Recomputing happens in the admin API on save (see lib/pricing.ts).
--
-- Prerequisite: supabase/schema.sql (the baseline) and migrations 2 (which
-- added provider_rate) and 3 have been run. Safe to re-run.

begin;

-- 1. Per-service charge overrides. Both nullable: null means "use the
--    global default", which is what an imported service lands with.
alter table public.services
  add column if not exists charge_percent numeric(6, 2),
  add column if not exists charge_flat numeric(12, 2);

comment on column public.services.charge_percent is
  'Per-service markup percent over provider_rate. Null = use the global bestclout_markup_percent.';
comment on column public.services.charge_flat is
  'Per-service flat NGN per 1,000 added on top. Null = use the global default_charge_flat.';

-- 2. Guardrails: a negative charge would let the sell price fall below cost,
--    and a percent of or below -100 is nonsense. Keep the values sane at the
--    database level too, not just in the app.
alter table public.services
  drop constraint if exists services_charge_percent_range,
  add constraint services_charge_percent_range
    check (charge_percent is null or charge_percent >= 0);

alter table public.services
  drop constraint if exists services_charge_flat_range,
  add constraint services_charge_flat_range
    check (charge_flat is null or charge_flat >= 0);

-- 3. Global defaults. The percent already exists (seeded by 2_bestclout as
--    bestclout_markup_percent = 30); this adds the flat fee, defaulting to 0
--    so behaviour is unchanged until an admin sets one.
insert into public.system_settings (key, value) values ('default_charge_flat', '0')
on conflict (key) do nothing;

-- 4. Record this migration (convention — see supabase/migrations/README.md).
insert into supabase_migrations.applied_migrations (version, name) values
  ('4', 'service_charge')
on conflict (version) do nothing;

commit;
