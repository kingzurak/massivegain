-- 2_bestclout
--
-- Wires the app to bestclout.com as a real fulfilment provider (the first
-- one after the built-in `manual` stub).
--
-- bestclout prices in NGN per 1,000 — the account's panel currency is NGN,
-- not USD — so every provider amount stored here is NGN and there is no FX
-- conversion anywhere. Our selling price is derived at import time as
-- provider_rate * (1 + markup), and stored in services.price_per_thousand
-- like any other service; the provider's own rate is kept alongside it so
-- margin stays auditable even if the markup setting changes later.
--
-- Prerequisite: supabase/schema.sql (the baseline) has been run against
-- this database. Safe to re-run.

begin;

-- 0. The migration ledger is normally created by 1_migration_tracking.sql,
--    but this file is written to be safe to paste on its own: without the
--    ledger, the self-record at the bottom would error and roll back every
--    change above it. Re-creating it here is idempotent (same DDL and grants
--    as the tracking migration).
create schema if not exists supabase_migrations;
revoke all on schema supabase_migrations from public, anon, authenticated;

create table if not exists supabase_migrations.applied_migrations (
  version text primary key,
  name text not null default '',
  applied_at timestamptz not null default now()
);

alter table supabase_migrations.applied_migrations enable row level security;

-- 1. Link each service to its upstream bestclout service and remember what
--    the provider charges. All nullable: manually fulfilled services have
--    none of this.
alter table public.services
  add column if not exists provider_service_id text,
  add column if not exists provider_rate numeric(12, 2),
  add column if not exists provider_service_type text;

comment on column public.services.provider_service_id is
  'Upstream provider service id (bestclout). Null for manually fulfilled services.';
comment on column public.services.provider_rate is
  'What the provider charges per 1,000, in NGN — kept to compute and audit margin.';
comment on column public.services.provider_service_type is
  'Provider service type (Default / Custom Comments / ...). Only Default auto-fulfils.';

-- Import and re-mapping look services up by provider service id.
create index if not exists services_provider_service_id_idx
  on public.services (provider_service_id);

-- 2. Provider-tracking fields on orders. provider / external_order_id
--    already exist (Milestone 7); these add cost + sync bookkeeping.
alter table public.orders
  add column if not exists provider_cost numeric(14, 2),
  add column if not exists provider_status text,
  add column if not exists provider_synced_at timestamptz,
  add column if not exists refund_required boolean not null default false;

comment on column public.orders.provider_cost is
  'What the provider charged for this order, in NGN (snapshot at placement).';
comment on column public.orders.provider_status is
  'Raw status text last returned by the provider.';
comment on column public.orders.refund_required is
  'Set when the provider cancelled an order — an admin must refund the customer.';

-- The sync job scans open provider orders that have an external id; this
-- partial index keeps that scan small regardless of total order volume.
create index if not exists orders_provider_sync_idx
  on public.orders (provider, status)
  where external_order_id is not null;

-- 3. Markup applied to the provider rate when importing, in percent.
insert into public.system_settings (key, value) values ('bestclout_markup_percent', '30')
on conflict (key) do nothing;

-- 4. Record the baseline and this migration (convention — see
--    supabase/migrations/README.md). The tracking migration is recorded too
--    because step 0 above has now provided the same ledger it would have.
insert into supabase_migrations.applied_migrations (version, name) values
  ('0000_baseline', 'supabase/schema.sql'),
  ('1', 'migration_tracking'),
  ('2', 'bestclout')
on conflict (version) do nothing;

commit;
