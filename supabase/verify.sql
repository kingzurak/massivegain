-- ---------------------------------------------------------------------------
-- MassiveGain.ng — schema verification (READ ONLY)
--
-- Paste this into the Supabase SQL editor after running supabase/schema.sql
-- (the baseline) and every migration under supabase/migrations/ (and any time
-- you suspect a partial or out-of-order application). It only reads catalog
-- views — it changes nothing.
--
-- Every result set below has an "expected" note in the section heading. If
-- something looks wrong, re-run the migration that owns that object, then
-- re-run this file.
-- ---------------------------------------------------------------------------


-- 1. Function EXECUTE privileges.
--    EXPECTED:
--      * place_order(uuid,uuid,integer,text,text)  -> service_role only
--      * settle_funding_success(text,numeric)      -> service_role only
--      * mark_funding_failed(text)                 -> service_role only
--      * grant_referral_commission(uuid,uuid,numeric) -> service_role only
--      * cancel_order_with_refund(uuid)            -> anon/authenticated OK
--        (it checks is_admin() internally and returns 'not_authorized')
--      * is_admin()                                -> authenticated OK
--    Anything else with anon/authenticated = true deserves a look.
select
  p.oid::regprocedure                                       as signature,
  has_function_privilege('anon',          p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role',  p.oid, 'execute') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by signature;


-- 2. place_order overloads.
--    EXPECTED: exactly ONE row, the 5-argument signature
--    (uuid, uuid, integer, text, text). Any older overload is a live bypass.
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'place_order'
order by signature;


-- 3. Row Level Security.
--    EXPECTED: rls_enabled = true for every row. A false here means a table
--    is readable/writable without any policy.
select
  c.relname      as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by table_name;


-- 4. Policy coverage per table.
--    EXPECTED: every table in query 3 also appears here. A table with RLS on
--    but zero policies is deny-all (safe, but probably a mistake).
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;


-- 5. Orders guard trigger.
--    EXPECTED: guard_order_integrity present and enabled (tgenabled = 'O').
--    This is what stops a direct status UPDATE from bypassing the refund /
--    commission logic, and what makes 'completed' terminal.
select
  t.tgname     as trigger_name,
  c.relname    as table_name,
  t.tgenabled  as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('orders', 'profiles')
order by table_name, trigger_name;


-- 6. Applied migrations.
--    EXPECTED: one row per file under supabase/migrations/, plus the
--    '0000_baseline' row recorded by 2_bestclout.sql.
select version, name, applied_at
from supabase_migrations.applied_migrations
order by applied_at, version;
