-- 3_order_integrity
--
-- Hardens order integrity and re-asserts the security boundary.
--
-- Two related changes, both safe to re-run and both idempotent:
--
--   1. A completed order is terminal. Once delivered — and, if the customer
--      was referred, once its commission has already been paid out — the
--      order cannot slide back to pending/processing or forward to
--      cancelled. Letting it do so would silently desync status from
--      commissions and leave no audit trail, so it is a hard error rather
--      than a silent revert.
--
--   2. Re-assert the privilege boundary. schema.sql is applied by hand,
--      top to bottom, and a partial or out-of-order run could leave an
--      older place_order() overload or an over-broad grant in place that
--      silently reopens a hole. Every statement here is a no-op when the
--      schema is already correct.
--
-- The trigger function is the full current definition (it also carries the
-- immutability rules and the "only cancel_order_with_refund() may cancel"
-- rule), so this file is the source of truth for it going forward.
--
-- Prerequisite: supabase/schema.sql (the baseline) has been run against
-- this database. Safe to re-run.
--
-- Run supabase/verify.sql afterwards to confirm the live database matches.

begin;

-- 1. Replace the orders guard trigger with the completed-is-terminal rule.
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

-- 2. Drop any pre-Milestone-9 place_order() overload. Both of these were
--    once granted to authenticated, which is exactly the direct-RPC bypass
--    Milestone 9 removed — if either survived a partial run, customers
--    could place orders (and spend wallets) without the server route.
drop function if exists public.place_order(uuid, integer, text);
drop function if exists public.place_order(uuid, integer, text, text);

-- 3. Re-assert that the service-role-only functions cannot be called by
--    anon or authenticated users, no matter what happened in an earlier run.
revoke all on function public.place_order(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, integer, text, text) to service_role;

revoke all on function public.settle_funding_success(text, numeric) from public, anon, authenticated;
grant execute on function public.settle_funding_success(text, numeric) to service_role;

revoke all on function public.mark_funding_failed(text) from public, anon, authenticated;
grant execute on function public.mark_funding_failed(text) to service_role;

revoke all on function public.grant_referral_commission(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.grant_referral_commission(uuid, uuid, numeric) to service_role;

-- 4. is_admin() must remain executable (the RLS policies call it), but it
--    only ever reads the caller's own row, so it is not a hole.
grant execute on function public.is_admin() to anon, authenticated;

-- 5. Record this migration (convention — see supabase/migrations/README.md).
insert into supabase_migrations.applied_migrations (version, name) values
  ('3', 'order_integrity')
on conflict (version) do nothing;

commit;
