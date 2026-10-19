-- MassiveGain.ng — Milestone 2 database foundation
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE where possible.

-- ---------------------------------------------------------------------------
-- 1. profiles table
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Auto-create a profile whenever a new auth user is created.
--    Role is always hardcoded to 'customer' here — the client can never
--    set its own role via signup metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Block self-service role escalation.
--    Any UPDATE made through the normal authenticated client API (PostgREST /
--    the Supabase client library) has its role change silently reverted.
--    Role changes are only possible when run OUTSIDE that context — e.g.
--    directly in the Supabase SQL editor, or via the service-role key —
--    where auth.role() is not 'authenticated'.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row
  execute procedure public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security policies
--    Customers can only ever see/update their own profile row.
--    There is no INSERT policy for authenticated/anon — rows are created
--    only by the handle_new_user trigger (SECURITY DEFINER), and there is
--    no DELETE policy — profiles are removed automatically via the
--    `on delete cascade` foreign key when the auth user is deleted.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- MILESTONE 3 — Services catalogue
-- Run this after the Milestone 2 statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 6. Admin-check helper, usable in RLS policies on any table.
--    SECURITY DEFINER so it can read profiles regardless of the caller's
--    own RLS visibility (avoids recursive-policy issues).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 7. categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "Anyone can view categories" on public.categories;
create policy "Anyone can view categories"
  on public.categories for select
  using (true);

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- 8. services
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  description text not null default '',
  price_per_thousand numeric(12, 2) not null check (price_per_thousand > 0),
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer not null check (max_quantity >= min_quantity),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
  before update on public.services
  for each row
  execute procedure public.set_updated_at();

-- Public (including logged-out visitors) can see only active services.
drop policy if exists "Anyone can view active services" on public.services;
create policy "Anyone can view active services"
  on public.services for select
  using (active = true);

-- Admins can see every service, active or not (combines with the policy
-- above via OR, so admins aren't limited to active-only rows).
drop policy if exists "Admins can view all services" on public.services;
create policy "Admins can view all services"
  on public.services for select
  using (public.is_admin());

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services"
  on public.services for insert
  with check (public.is_admin());

drop policy if exists "Admins can update services" on public.services;
create policy "Admins can update services"
  on public.services for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete services" on public.services;
create policy "Admins can delete services"
  on public.services for delete
  using (public.is_admin());

grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;

-- 9. Starter categories so the admin "Add service" form has options
--    immediately. Safe to re-run — ON CONFLICT skips duplicates.
insert into public.categories (name) values
  ('Instagram'), ('Facebook'), ('TikTok'), ('YouTube'), ('WhatsApp'), ('Twitter/X')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- MILESTONE 4 — Wallets + transactions (Paystack funding)
-- Run after the Milestone 2 and 3 statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 10. wallets: one row per user. Balance is changed ONLY by server-side
--     functions below (service role). Customers can read their own row only.
create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
  before update on public.wallets
  for each row
  execute procedure public.set_updated_at();

drop policy if exists "Users can view own wallet" on public.wallets;
create policy "Users can view own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

-- Read-only for customers: no insert/update/delete grants or policies.
grant select on public.wallets to authenticated;

-- 11. transactions: wallet ledger. Credits positive, debits negative.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('funding', 'order', 'refund')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  amount numeric(14, 2) not null,
  balance_after numeric(14, 2),
  reference text not null unique,
  provider text,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

alter table public.transactions enable row level security;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row
  execute procedure public.set_updated_at();

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Read-only for customers: only server-side code (service role) writes.
grant select on public.transactions to authenticated;

-- 12. Create a wallet automatically for every new user (extends the
--     Milestone 2 trigger function), and backfill existing users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  );

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- 13. Credit a wallet after a VERIFIED successful Paystack payment.
--     - Locks the transaction row, so the callback and the webhook running
--       at the same time can never credit twice (idempotent).
--     - Refuses to credit if the amount Paystack reports differs from the
--       amount we recorded when the payment was started.
create or replace function public.settle_funding_success(p_reference text, p_paid_amount numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.transactions%rowtype;
  new_balance numeric;
begin
  select * into tx
  from public.transactions
  where reference = p_reference and type = 'funding'
  for update;

  if not found then
    return 'not_found';
  end if;

  if tx.status = 'success' then
    return 'already_processed';
  end if;

  if tx.amount <> p_paid_amount then
    return 'amount_mismatch';
  end if;

  insert into public.wallets (user_id, balance)
  values (tx.user_id, tx.amount)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance
  returning balance into new_balance;

  update public.transactions
  set status = 'success', balance_after = new_balance
  where id = tx.id;

  return 'credited';
end;
$$;

-- 14. Mark a still-pending funding attempt as failed (never touches
--     successful rows).
create or replace function public.mark_funding_failed(p_reference text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.transactions
  set status = 'failed'
  where reference = p_reference and type = 'funding' and status = 'pending';
$$;

-- Only the server (service role) may run these — never a browser user.
revoke all on function public.settle_funding_success(text, numeric) from public, anon, authenticated;
revoke all on function public.mark_funding_failed(text) from public, anon, authenticated;
grant execute on function public.settle_funding_success(text, numeric) to service_role;
grant execute on function public.mark_funding_failed(text) to service_role;

-- ---------------------------------------------------------------------------
-- MILESTONE 5 — Orders + atomic wallet deduction
-- Run after the Milestone 2, 3 and 4 statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 15. orders
create sequence if not exists public.orders_order_number_seq start with 10001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('MG-' || nextval('public.orders_order_number_seq')),
  user_id uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute procedure public.set_updated_at();

drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders for select
  using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT policy/grant for authenticated: orders are only ever created by
-- the place_order() function below, never by a direct client insert.
grant select, update on public.orders to authenticated;

-- 16. Link each order-type transaction back to the order it paid for.
alter table public.transactions
  add column if not exists order_id uuid references public.orders (id) on delete set null;

-- 17. place_order — the only way an order is ever created.
--     Runs as the function owner (SECURITY DEFINER) so it can write to
--     orders/wallets/transactions despite customers having no direct write
--     grant on those tables, but it ALWAYS uses auth.uid() for who is
--     ordering — a client can never place an order as another user.
--
--     Idempotent: p_reference is unique on transactions.reference. If the
--     same reference is submitted twice (e.g. a retried request after a
--     dropped connection), the second call returns the first call's result
--     instead of charging the wallet again.
create or replace function public.place_order(
  p_service_id uuid,
  p_quantity integer,
  p_reference text
)
returns table (
  outcome text,
  order_id uuid,
  order_number text,
  amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric(14, 2);
  v_order public.orders%rowtype;
  v_existing_tx public.transactions%rowtype;
begin
  if v_user is null then
    return query select 'not_authenticated', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_reference is null or length(trim(p_reference)) = 0 then
    return query select 'invalid_reference', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  -- Idempotency check.
  select * into v_existing_tx from public.transactions where reference = p_reference;
  if found then
    select * into v_order from public.orders where id = v_existing_tx.order_id;
    return query
      select 'already_processed', v_order.id, v_order.order_number,
             abs(v_existing_tx.amount), v_existing_tx.balance_after;
    return;
  end if;

  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.active is not true then
    return query select 'service_unavailable', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_quantity is null or p_quantity < v_service.min_quantity or p_quantity > v_service.max_quantity then
    return query select 'invalid_quantity', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  v_amount := round(v_service.price_per_thousand * p_quantity / 1000.0, 2);

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    insert into public.wallets (user_id) values (v_user) returning * into v_wallet;
  end if;

  if v_wallet.balance < v_amount then
    return query select 'insufficient_balance', null::uuid, null::text, v_amount, v_wallet.balance;
    return;
  end if;

  insert into public.orders (user_id, service_id, quantity, amount, status)
  values (v_user, p_service_id, p_quantity, v_amount, 'pending')
  returning * into v_order;

  update public.wallets
  set balance = balance - v_amount
  where user_id = v_user
  returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_user, 'order', 'success', -v_amount, v_wallet.balance, p_reference, 'wallet',
    'Order ' || v_order.order_number || ' — ' || v_service.name,
    v_order.id
  );

  return query select 'success', v_order.id, v_order.order_number, v_amount, v_wallet.balance;
end;
$$;

-- Callable directly by any signed-in customer (it only ever acts on their
-- own auth.uid()); logged-out (anon) cannot call it at all.
revoke all on function public.place_order(uuid, integer, text) from public, anon;
grant execute on function public.place_order(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- MILESTONE 6 — Admin management foundation (Step 1: Users)
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 18. Account status, for admin suspend/activate.
alter table public.profiles
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));

-- 19. Admins can see and update every profile (previously only their own).
--     This does NOT touch the `role` column's protection — the Milestone 2
--     `protect_profile_role` trigger still silently reverts any role change
--     made through the normal authenticated client, admins included.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 20. Admins can see every user's transactions (previously only their own) —
--     needed for the financial-logs page later in this milestone. Still no
--     write access: the ledger is only ever written by server-side code.
drop policy if exists "Admins can view all transactions" on public.transactions;
create policy "Admins can view all transactions"
  on public.transactions for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- MILESTONE 7 — Fulfilment / provider architecture + order cancellation refund
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 21. Which backend fulfils a service. 'manual' is the only implementation
--     today (no external API is integrated yet) — this column exists so a
--     real provider can be assigned per-service later with no schema change.
alter table public.services
  add column if not exists provider text not null default 'manual';

-- 22. Fulfilment + provider-tracking fields on orders.
--     provider is copied from the service at order-placement time, so an
--     order always "remembers" which backend was responsible even if the
--     service's provider is changed later.
alter table public.orders
  add column if not exists provider text not null default 'manual',
  add column if not exists external_order_id text,
  add column if not exists start_count integer,
  add column if not exists link text,
  add column if not exists admin_notes text not null default '';

-- 23. place_order(), updated only to stamp the order's provider from its
--     service. Everything else is unchanged from Milestone 5.
create or replace function public.place_order(
  p_service_id uuid,
  p_quantity integer,
  p_reference text
)
returns table (
  outcome text,
  order_id uuid,
  order_number text,
  amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric(14, 2);
  v_order public.orders%rowtype;
  v_existing_tx public.transactions%rowtype;
begin
  if v_user is null then
    return query select 'not_authenticated', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_reference is null or length(trim(p_reference)) = 0 then
    return query select 'invalid_reference', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  select * into v_existing_tx from public.transactions where reference = p_reference;
  if found then
    select * into v_order from public.orders where id = v_existing_tx.order_id;
    return query
      select 'already_processed', v_order.id, v_order.order_number,
             abs(v_existing_tx.amount), v_existing_tx.balance_after;
    return;
  end if;

  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.active is not true then
    return query select 'service_unavailable', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_quantity is null or p_quantity < v_service.min_quantity or p_quantity > v_service.max_quantity then
    return query select 'invalid_quantity', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  v_amount := round(v_service.price_per_thousand * p_quantity / 1000.0, 2);

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    insert into public.wallets (user_id) values (v_user) returning * into v_wallet;
  end if;

  if v_wallet.balance < v_amount then
    return query select 'insufficient_balance', null::uuid, null::text, v_amount, v_wallet.balance;
    return;
  end if;

  insert into public.orders (user_id, service_id, quantity, amount, status, provider)
  values (v_user, p_service_id, p_quantity, v_amount, 'pending', v_service.provider)
  returning * into v_order;

  update public.wallets
  set balance = balance - v_amount
  where user_id = v_user
  returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_user, 'order', 'success', -v_amount, v_wallet.balance, p_reference, 'wallet',
    'Order ' || v_order.order_number || ' — ' || v_service.name,
    v_order.id
  );

  return query select 'success', v_order.id, v_order.order_number, v_amount, v_wallet.balance;
end;
$$;

-- 24. cancel_order_with_refund — the ONLY way an order is cancelled with a
--     refund. Admin-only (checked internally via is_admin(), since Postgres
--     grants can't see our application-level role column). Idempotent via
--     a deterministic reference ('refund_<order id>'), same pattern as
--     settle_funding_success — calling it twice on the same order only
--     credits the wallet once.
create or replace function public.cancel_order_with_refund(p_order_id uuid)
returns table (
  outcome text,
  order_id uuid,
  refund_amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.transactions%rowtype;
  v_reference text;
begin
  if not public.is_admin() then
    return query select 'not_authorized', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'not_found', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  if v_order.status = 'cancelled' then
    select * into v_existing from public.transactions
      where order_id = v_order.id and type = 'refund'
      limit 1;
    return query
      select 'already_cancelled', v_order.id,
             coalesce(v_existing.amount, 0), v_existing.balance_after;
    return;
  end if;

  if v_order.status = 'completed' then
    return query select 'invalid_status', v_order.id, null::numeric, null::numeric;
    return;
  end if;

  v_reference := 'refund_' || v_order.id;

  select * into v_wallet from public.wallets where user_id = v_order.user_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_order.user_id) returning * into v_wallet;
  end if;

  update public.wallets
    set balance = balance + v_order.amount
    where user_id = v_order.user_id
    returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_order.user_id, 'refund', 'success', v_order.amount, v_wallet.balance,
    v_reference, 'wallet', 'Refund for order ' || v_order.order_number, v_order.id
  );

  update public.orders set status = 'cancelled' where id = v_order.id;

  return query select 'cancelled', v_order.id, v_order.amount, v_wallet.balance;
end;
$$;

revoke all on function public.cancel_order_with_refund(uuid) from public, anon;
grant execute on function public.cancel_order_with_refund(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- MILESTONE 7 FOLLOW-UP — capture the customer's target link at order time
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 25. place_order() gains a required p_link parameter. This changes the
--     function's signature (3 args -> 4), so the OLD 3-arg version must be
--     dropped explicitly — CREATE OR REPLACE does not replace a function
--     with a different parameter list, it would just add a second
--     overload, and the old one (with no link handling at all) would
--     stay callable and bypass this requirement entirely.
drop function if exists public.place_order(uuid, integer, text);

create or replace function public.place_order(
  p_service_id uuid,
  p_quantity integer,
  p_reference text,
  p_link text
)
returns table (
  outcome text,
  order_id uuid,
  order_number text,
  amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric(14, 2);
  v_order public.orders%rowtype;
  v_existing_tx public.transactions%rowtype;
  v_link text := trim(coalesce(p_link, ''));
begin
  if v_user is null then
    return query select 'not_authenticated', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_reference is null or length(trim(p_reference)) = 0 then
    return query select 'invalid_reference', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if v_link = '' or v_link !~* '^https?://' then
    return query select 'invalid_link', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  select * into v_existing_tx from public.transactions where reference = p_reference;
  if found then
    select * into v_order from public.orders where id = v_existing_tx.order_id;
    return query
      select 'already_processed', v_order.id, v_order.order_number,
             abs(v_existing_tx.amount), v_existing_tx.balance_after;
    return;
  end if;

  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.active is not true then
    return query select 'service_unavailable', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_quantity is null or p_quantity < v_service.min_quantity or p_quantity > v_service.max_quantity then
    return query select 'invalid_quantity', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  v_amount := round(v_service.price_per_thousand * p_quantity / 1000.0, 2);

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    insert into public.wallets (user_id) values (v_user) returning * into v_wallet;
  end if;

  if v_wallet.balance < v_amount then
    return query select 'insufficient_balance', null::uuid, null::text, v_amount, v_wallet.balance;
    return;
  end if;

  insert into public.orders (user_id, service_id, quantity, amount, status, provider, link)
  values (v_user, p_service_id, p_quantity, v_amount, 'pending', v_service.provider, v_link)
  returning * into v_order;

  update public.wallets
  set balance = balance - v_amount
  where user_id = v_user
  returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_user, 'order', 'success', -v_amount, v_wallet.balance, p_reference, 'wallet',
    'Order ' || v_order.order_number || ' — ' || v_service.name,
    v_order.id
  );

  return query select 'success', v_order.id, v_order.order_number, v_amount, v_wallet.balance;
end;
$$;

revoke all on function public.place_order(uuid, integer, text, text) from public, anon;
grant execute on function public.place_order(uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- MILESTONE 8 STEP 2 — Referrals & lifetime order commissions
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 26. system_settings — small admin-editable key/value config store.
--     Public read (it's just numbers like a commission rate, nothing
--     sensitive), admin-only write — same pattern as `categories`.
create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row
  execute procedure public.set_updated_at();

drop policy if exists "Anyone can view settings" on public.system_settings;
create policy "Anyone can view settings"
  on public.system_settings for select
  using (true);

drop policy if exists "Admins can manage settings" on public.system_settings;
create policy "Admins can manage settings"
  on public.system_settings for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.system_settings to anon, authenticated;
grant insert, update, delete on public.system_settings to authenticated;

insert into public.system_settings (key, value) values ('referral_commission_rate', '5.0')
on conflict (key) do nothing;

-- 27. Referral code + who referred each user. Nullable at first so we can
--     backfill existing accounts, then locked to NOT NULL for the code.
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

do $$
declare
  r record;
  v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    loop
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text || r.id::text), 1, 8));
      exit when not exists (select 1 from public.profiles where referral_code = v_code);
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column referral_code set not null;

-- 28. Let 'commission' transactions exist (payouts are positive, reversals
--     on order cancellation are negative — same sign convention already
--     used for 'order').
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('funding', 'order', 'refund', 'commission'));

-- 29. One row per order that ever generated a commission. The unique index
--     on order_id is what makes commission payout idempotent — at most one
--     commission can ever exist for a given order, so grant_referral_
--     commission() can safely be called more than once without double-paying.
create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid not null references public.profiles (id) on delete cascade,
  rate numeric(5, 2) not null,
  amount numeric(14, 2) not null,
  status text not null default 'paid' check (status in ('paid', 'reversed', 'skipped_suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists referral_commissions_order_unique
  on public.referral_commissions (order_id);

alter table public.referral_commissions enable row level security;

drop trigger if exists set_referral_commissions_updated_at on public.referral_commissions;
create trigger set_referral_commissions_updated_at
  before update on public.referral_commissions
  for each row
  execute procedure public.set_updated_at();

drop policy if exists "Referrers can view own commissions" on public.referral_commissions;
create policy "Referrers can view own commissions"
  on public.referral_commissions for select
  using (auth.uid() = referrer_id);

drop policy if exists "Admins can view all commissions" on public.referral_commissions;
create policy "Admins can view all commissions"
  on public.referral_commissions for select
  using (public.is_admin());

-- No write grant for authenticated at all — only the functions below
-- (SECURITY DEFINER) ever write to this table.
grant select on public.referral_commissions to authenticated;

-- 30. handle_new_user(), extended to resolve a referral code from signup
--     metadata into `referred_by`, and to generate this user's own code.
--     Self-referral is structurally impossible here (a brand-new user's id
--     can't yet match any existing profile), but the checks are kept
--     explicit rather than relying on that being true forever.
--     NOTE: this only blocks it at the profile/email level. It does not do
--     IP-based fraud detection — this stack has no signup IP capture today,
--     so that part of "check IP/email/profile ID" is not implemented.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_referrer_id uuid;
  v_referrer_email text;
  v_ref_input text := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  if v_ref_input is not null then
    select id, email into v_referrer_id, v_referrer_email
      from public.profiles where referral_code = v_ref_input;

    if v_referrer_id = new.id or v_referrer_email = new.email then
      v_referrer_id := null; -- self-referral guard
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer',
    v_code,
    v_referrer_id
  );

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 31. grant_referral_commission() — called internally by place_order()
--     only. Never exposed to PostgREST/RPC directly (no grant to anon or
--     authenticated below), so it can't be invoked except from within
--     another SECURITY DEFINER function we control.
create or replace function public.grant_referral_commission(
  p_order_id uuid,
  p_buyer_id uuid,
  p_order_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referrer_status text;
  v_rate numeric(5, 2);
  v_commission numeric(14, 2);
  v_wallet public.wallets%rowtype;
  v_rows int;
begin
  select referred_by into v_referrer_id from public.profiles where id = p_buyer_id;
  if v_referrer_id is null or v_referrer_id = p_buyer_id then
    return;
  end if;

  select status into v_referrer_status from public.profiles where id = v_referrer_id;
  if v_referrer_status is null then
    return;
  end if;

  select coalesce(value::numeric, 5.0) into v_rate
    from public.system_settings where key = 'referral_commission_rate';
  v_rate := coalesce(v_rate, 5.0);

  v_commission := round(p_order_amount * v_rate / 100.0, 2);
  if v_commission <= 0 then
    return;
  end if;

  if v_referrer_status <> 'active' then
    -- Suspended referrer: log what would have been paid, pay nothing.
    insert into public.referral_commissions
      (order_id, referrer_id, referred_user_id, rate, amount, status)
    values (p_order_id, v_referrer_id, p_buyer_id, v_rate, v_commission, 'skipped_suspended')
    on conflict (order_id) do nothing;
    return;
  end if;

  insert into public.referral_commissions
    (order_id, referrer_id, referred_user_id, rate, amount, status)
  values (p_order_id, v_referrer_id, p_buyer_id, v_rate, v_commission, 'paid')
  on conflict (order_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return; -- a commission already exists for this order — never pay twice
  end if;

  select * into v_wallet from public.wallets where user_id = v_referrer_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_referrer_id) returning * into v_wallet;
  end if;

  update public.wallets
    set balance = balance + v_commission
    where user_id = v_referrer_id
    returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_referrer_id, 'commission', 'success', v_commission, v_wallet.balance,
    'comm_' || p_order_id, 'referral',
    'Referral commission (' || v_rate || '%)', p_order_id
  );
end;
$$;

revoke all on function public.grant_referral_commission(uuid, uuid, numeric) from public, anon, authenticated;

-- 32. place_order(), extended only to grant a commission after the order
--     and its own transaction are written — same signature as the link-
--     capture follow-up, so no DROP is needed this time.
create or replace function public.place_order(
  p_service_id uuid,
  p_quantity integer,
  p_reference text,
  p_link text
)
returns table (
  outcome text,
  order_id uuid,
  order_number text,
  amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric(14, 2);
  v_order public.orders%rowtype;
  v_existing_tx public.transactions%rowtype;
  v_link text := trim(coalesce(p_link, ''));
begin
  if v_user is null then
    return query select 'not_authenticated', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_reference is null or length(trim(p_reference)) = 0 then
    return query select 'invalid_reference', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if v_link = '' or v_link !~* '^https?://' then
    return query select 'invalid_link', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  select * into v_existing_tx from public.transactions where reference = p_reference;
  if found then
    select * into v_order from public.orders where id = v_existing_tx.order_id;
    return query
      select 'already_processed', v_order.id, v_order.order_number,
             abs(v_existing_tx.amount), v_existing_tx.balance_after;
    return;
  end if;

  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.active is not true then
    return query select 'service_unavailable', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_quantity is null or p_quantity < v_service.min_quantity or p_quantity > v_service.max_quantity then
    return query select 'invalid_quantity', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  v_amount := round(v_service.price_per_thousand * p_quantity / 1000.0, 2);

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    insert into public.wallets (user_id) values (v_user) returning * into v_wallet;
  end if;

  if v_wallet.balance < v_amount then
    return query select 'insufficient_balance', null::uuid, null::text, v_amount, v_wallet.balance;
    return;
  end if;

  insert into public.orders (user_id, service_id, quantity, amount, status, provider, link)
  values (v_user, p_service_id, p_quantity, v_amount, 'pending', v_service.provider, v_link)
  returning * into v_order;

  update public.wallets
  set balance = balance - v_amount
  where user_id = v_user
  returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_user, 'order', 'success', -v_amount, v_wallet.balance, p_reference, 'wallet',
    'Order ' || v_order.order_number || ' — ' || v_service.name,
    v_order.id
  );

  perform public.grant_referral_commission(v_order.id, v_user, v_amount);

  return query select 'success', v_order.id, v_order.order_number, v_amount, v_wallet.balance;
end;
$$;

-- 33. cancel_order_with_refund(), extended to reverse any commission that
--     was paid for this order. Caps the clawback at the referrer's current
--     balance (wallets.balance can never go negative — same invariant the
--     rest of the app already relies on) and records exactly what was
--     actually recovered as a negative 'commission' transaction, even if
--     that's less than the original payout.
create or replace function public.cancel_order_with_refund(p_order_id uuid)
returns table (
  outcome text,
  order_id uuid,
  refund_amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.transactions%rowtype;
  v_reference text;
  v_commission public.referral_commissions%rowtype;
  v_ref_wallet public.wallets%rowtype;
  v_deduct numeric(14, 2);
begin
  if not public.is_admin() then
    return query select 'not_authorized', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'not_found', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  if v_order.status = 'cancelled' then
    select * into v_existing from public.transactions
      where order_id = v_order.id and type = 'refund'
      limit 1;
    return query
      select 'already_cancelled', v_order.id,
             coalesce(v_existing.amount, 0), v_existing.balance_after;
    return;
  end if;

  if v_order.status = 'completed' then
    return query select 'invalid_status', v_order.id, null::numeric, null::numeric;
    return;
  end if;

  v_reference := 'refund_' || v_order.id;

  select * into v_wallet from public.wallets where user_id = v_order.user_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_order.user_id) returning * into v_wallet;
  end if;

  update public.wallets
    set balance = balance + v_order.amount
    where user_id = v_order.user_id
    returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_order.user_id, 'refund', 'success', v_order.amount, v_wallet.balance,
    v_reference, 'wallet', 'Refund for order ' || v_order.order_number, v_order.id
  );

  -- Reverse a paid commission for this order, if one exists.
  select * into v_commission from public.referral_commissions
    where order_id = v_order.id and status = 'paid' for update;

  if found then
    select * into v_ref_wallet from public.wallets where user_id = v_commission.referrer_id for update;
    v_deduct := least(v_commission.amount, coalesce(v_ref_wallet.balance, 0));

    if v_deduct > 0 then
      update public.wallets
        set balance = balance - v_deduct
        where user_id = v_commission.referrer_id
        returning * into v_ref_wallet;

      insert into public.transactions
        (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
      values (
        v_commission.referrer_id, 'commission', 'success', -v_deduct, v_ref_wallet.balance,
        'comm_reversal_' || v_order.id, 'referral',
        'Referral commission reversed for cancelled order ' || v_order.order_number
          || case when v_deduct < v_commission.amount then ' (partial — balance was insufficient)' else '' end,
        v_order.id
      );
    end if;

    update public.referral_commissions set status = 'reversed' where id = v_commission.id;
  end if;

  update public.orders set status = 'cancelled' where id = v_order.id;

  return query select 'cancelled', v_order.id, v_order.amount, v_wallet.balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- MILESTONE 9 STEP 1 — RLS + input-validation audit hardening
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 34. Lock down orders so the business rules already enforced by
--     place_order()/cancel_order_with_refund() can't be bypassed by a
--     direct table update (the "Admins can update orders" RLS policy
--     otherwise allows any column, including status, to be changed
--     directly — which would mark an order cancelled with NO refund and
--     NO commission reversal).
--
--     - amount/service_id/user_id/quantity/order_number are immutable
--       after creation, always, no exceptions.
--     - status can never transition to or from 'cancelled' directly;
--       only cancel_order_with_refund() may do that, via a transaction-
--       local flag it sets right before its own update.
--     - 'completed' is terminal: once delivered, an order cannot be moved
--       to any other status (regression to processing/pending is rejected).
create or replace function public.guard_order_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount is distinct from old.amount
     or new.service_id is distinct from old.service_id
     or new.user_id is distinct from old.user_id
     or new.quantity is distinct from old.quantity
     or new.order_number is distinct from old.order_number
  then
    raise exception 'orders.amount/service_id/user_id/quantity/order_number cannot be changed after creation';
  end if;

  if new.status is distinct from old.status
     and (new.status = 'cancelled' or old.status = 'cancelled')
     and coalesce(current_setting('massivegain.allow_order_cancel', true), '') <> 'on'
  then
    raise exception 'orders can only be cancelled via cancel_order_with_refund()';
  end if;

  -- A completed order is final: it has been delivered, and if the customer
  -- was referred, its commission has already been paid out. Letting it slide
  -- back to pending/processing (or forward to cancelled) would silently
  -- desync status from commissions and leave no audit trail. Deliberately a
  -- hard error rather than a silent revert, so the mistake is visible.
  if old.status = 'completed' and new.status is distinct from 'completed' then
    raise exception 'completed orders are final and cannot be moved to another status';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_integrity on public.orders;
create trigger guard_order_integrity
  before update on public.orders
  for each row
  execute procedure public.guard_order_integrity();

-- cancel_order_with_refund() must now explicitly permit its own cancel.
create or replace function public.cancel_order_with_refund(p_order_id uuid)
returns table (
  outcome text,
  order_id uuid,
  refund_amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing public.transactions%rowtype;
  v_reference text;
  v_commission public.referral_commissions%rowtype;
  v_ref_wallet public.wallets%rowtype;
  v_deduct numeric(14, 2);
begin
  if not public.is_admin() then
    return query select 'not_authorized', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'not_found', null::uuid, null::numeric, null::numeric;
    return;
  end if;

  if v_order.status = 'cancelled' then
    select * into v_existing from public.transactions
      where order_id = v_order.id and type = 'refund'
      limit 1;
    return query
      select 'already_cancelled', v_order.id,
             coalesce(v_existing.amount, 0), v_existing.balance_after;
    return;
  end if;

  if v_order.status = 'completed' then
    return query select 'invalid_status', v_order.id, null::numeric, null::numeric;
    return;
  end if;

  v_reference := 'refund_' || v_order.id;

  select * into v_wallet from public.wallets where user_id = v_order.user_id for update;
  if not found then
    insert into public.wallets (user_id) values (v_order.user_id) returning * into v_wallet;
  end if;

  update public.wallets
    set balance = balance + v_order.amount
    where user_id = v_order.user_id
    returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_order.user_id, 'refund', 'success', v_order.amount, v_wallet.balance,
    v_reference, 'wallet', 'Refund for order ' || v_order.order_number, v_order.id
  );

  select * into v_commission from public.referral_commissions
    where order_id = v_order.id and status = 'paid' for update;

  if found then
    select * into v_ref_wallet from public.wallets where user_id = v_commission.referrer_id for update;
    v_deduct := least(v_commission.amount, coalesce(v_ref_wallet.balance, 0));

    if v_deduct > 0 then
      update public.wallets
        set balance = balance - v_deduct
        where user_id = v_commission.referrer_id
        returning * into v_ref_wallet;

      insert into public.transactions
        (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
      values (
        v_commission.referrer_id, 'commission', 'success', -v_deduct, v_ref_wallet.balance,
        'comm_reversal_' || v_order.id, 'referral',
        'Referral commission reversed for cancelled order ' || v_order.order_number
          || case when v_deduct < v_commission.amount then ' (partial — balance was insufficient)' else '' end,
        v_order.id
      );
    end if;

    update public.referral_commissions set status = 'reversed' where id = v_commission.id;
  end if;

  perform set_config('massivegain.allow_order_cancel', 'on', true);
  update public.orders set status = 'cancelled' where id = v_order.id;

  return query select 'cancelled', v_order.id, v_order.amount, v_wallet.balance;
end;
$$;

-- 35. Stop a user (customer or admin) from changing their OWN status.
--     Admin-suspends-someone-else still works fine — that goes through the
--     separate "Admins can update profiles" policy and auth.uid() <> id
--     there, so this trigger never fires for it. Only self-service status
--     changes are blocked, silently reverted (same style as the existing
--     role-protection trigger below it).
create or replace function public.prevent_self_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and auth.uid() = new.id then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_status on public.profiles;
create trigger protect_profile_status
  before update on public.profiles
  for each row
  execute procedure public.prevent_self_status_change();

-- 36. Length caps on customer-supplied free text — nothing previously
--     stopped an arbitrarily large string here.
alter table public.orders drop constraint if exists orders_link_length_check;
alter table public.orders
  add constraint orders_link_length_check check (char_length(link) <= 2048);

alter table public.profiles drop constraint if exists profiles_full_name_length_check;
alter table public.profiles
  add constraint profiles_full_name_length_check check (char_length(full_name) <= 200);

-- ---------------------------------------------------------------------------
-- MILESTONE 9 STEP 2 — close the place_order() direct-RPC bypass
-- Run after all statements above (safe to re-run).
-- ---------------------------------------------------------------------------

-- 37. place_order() no longer trusts auth.uid() — it now takes an explicit
--     p_user_id, and EXECUTE is revoked from anon/authenticated entirely
--     and granted only to service_role. This means it can no longer be
--     called directly from the browser at all (supabase.rpc() with the
--     anon key will now fail with a permission error) — the ONLY way to
--     place an order is through /api/orders/place, which authenticates the
--     user via their session first and then calls this function with the
--     service-role client, passing that verified id explicitly. This is
--     what makes the rate limiting on that route actually mean something:
--     there is no other door left into order placement.
--
--     Trusting p_user_id is safe specifically because EXECUTE is restricted
--     to service_role, and the only code holding that key is our own
--     server route, which never accepts a client-supplied user id — it
--     always uses the id from a verified getUser() call.
drop function if exists public.place_order(uuid, integer, text, text);

create or replace function public.place_order(
  p_user_id uuid,
  p_service_id uuid,
  p_quantity integer,
  p_reference text,
  p_link text
)
returns table (
  outcome text,
  order_id uuid,
  order_number text,
  amount numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := p_user_id;
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_amount numeric(14, 2);
  v_order public.orders%rowtype;
  v_existing_tx public.transactions%rowtype;
  v_link text := trim(coalesce(p_link, ''));
begin
  if v_user is null then
    return query select 'not_authenticated', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_reference is null or length(trim(p_reference)) = 0 then
    return query select 'invalid_reference', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if v_link = '' or v_link !~* '^https?://' then
    return query select 'invalid_link', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  select * into v_existing_tx from public.transactions where reference = p_reference;
  if found then
    select * into v_order from public.orders where id = v_existing_tx.order_id;
    return query
      select 'already_processed', v_order.id, v_order.order_number,
             abs(v_existing_tx.amount), v_existing_tx.balance_after;
    return;
  end if;

  select * into v_service from public.services where id = p_service_id for update;
  if not found or v_service.active is not true then
    return query select 'service_unavailable', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_quantity is null or p_quantity < v_service.min_quantity or p_quantity > v_service.max_quantity then
    return query select 'invalid_quantity', null::uuid, null::text, null::numeric, null::numeric;
    return;
  end if;

  v_amount := round(v_service.price_per_thousand * p_quantity / 1000.0, 2);

  select * into v_wallet from public.wallets where user_id = v_user for update;
  if not found then
    insert into public.wallets (user_id) values (v_user) returning * into v_wallet;
  end if;

  if v_wallet.balance < v_amount then
    return query select 'insufficient_balance', null::uuid, null::text, v_amount, v_wallet.balance;
    return;
  end if;

  insert into public.orders (user_id, service_id, quantity, amount, status, provider, link)
  values (v_user, p_service_id, p_quantity, v_amount, 'pending', v_service.provider, v_link)
  returning * into v_order;

  update public.wallets
  set balance = balance - v_amount
  where user_id = v_user
  returning * into v_wallet;

  insert into public.transactions
    (user_id, type, status, amount, balance_after, reference, provider, description, order_id)
  values (
    v_user, 'order', 'success', -v_amount, v_wallet.balance, p_reference, 'wallet',
    'Order ' || v_order.order_number || ' — ' || v_service.name,
    v_order.id
  );

  perform public.grant_referral_commission(v_order.id, v_user, v_amount);

  return query select 'success', v_order.id, v_order.order_number, v_amount, v_wallet.balance;
end;
$$;

revoke all on function public.place_order(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- MILESTONE 9 STEP 3 — missing indexes
-- Run after all statements above (safe to re-run).
-- Each one below is backed by an actual query path, not added speculatively.
-- ---------------------------------------------------------------------------

-- 38. profiles.referred_by — filtered directly in /dashboard/referrals
--     (count of people referred by the current user).
create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

-- 39. referral_commissions.referrer_id — this is the column the RLS policy
--     "Referrers can view own commissions" filters on for every single
--     commission-history query a referrer makes, even though no app code
--     writes an explicit .eq() for it (RLS adds the filter implicitly).
create index if not exists referral_commissions_referrer_idx
  on public.referral_commissions (referrer_id);

-- 40. orders.service_id — FK to services, not hit by any hot read path
--     today (no "orders for this service" view exists yet), but standard
--     practice for an FK column and keeps the ON DELETE RESTRICT check
--     cheap if that's ever exercised.
create index if not exists orders_service_id_idx
  on public.orders (service_id);

-- 41. transactions.order_id — NOT on the original list, but found while
--     checking real query paths: cancel_order_with_refund() does
--     `where order_id = ... and type = 'refund'` on every cancellation to
--     check idempotency, and a second lookup for the commission reversal.
--     No index existed for either.
create index if not exists transactions_order_id_idx
  on public.transactions (order_id);

-- Note: orders.user_id was requested too, but is already the leading
-- column of orders_user_created_idx(user_id, created_at desc) from
-- Milestone 5 — Postgres can use a multi-column btree's leading column
-- for a plain equality filter, so a separate single-column index here
-- would just add write overhead with no read benefit. Skipped on purpose.

-- ---------------------------------------------------------------------------
-- HARDENING — re-assert the security boundary (safe to re-run, must be last)
--
-- This section exists because the file is applied by hand, top to bottom,
-- and a partial or out-of-order run could leave an older overload or grant
-- in place that silently reopens a hole this file otherwise closes. Every
-- statement here is a no-op when the schema is already correct.
--
-- Run supabase/verify.sql afterwards to confirm the live database matches.
-- ---------------------------------------------------------------------------

-- 42. Drop any pre-Milestone-9 place_order() overload. Both of these were
--     once granted to authenticated, which is exactly the direct-RPC bypass
--     Milestone 9 removed — if either survived a partial run, customers
--     could place orders (and spend wallets) without the server route.
drop function if exists public.place_order(uuid, integer, text);
drop function if exists public.place_order(uuid, integer, text, text);

-- 43. Re-assert that the service-role-only functions cannot be called by
--     anon or authenticated users, no matter what happened earlier in the
--     file (or in a hand-run snippet).
revoke all on function public.place_order(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, integer, text, text) to service_role;

revoke all on function public.settle_funding_success(text, numeric) from public, anon, authenticated;
grant execute on function public.settle_funding_success(text, numeric) to service_role;

revoke all on function public.mark_funding_failed(text) from public, anon, authenticated;
grant execute on function public.mark_funding_failed(text) to service_role;

revoke all on function public.grant_referral_commission(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.grant_referral_commission(uuid, uuid, numeric) to service_role;

-- 44. is_admin() must remain executable (the RLS policies call it), but it
--     only ever reads the caller's own row, so it is not a hole.
grant execute on function public.is_admin() to anon, authenticated;
