-- 20261019000000_migration_tracking
--
-- Establishes the migration ledger and records the baseline as applied.
-- Prerequisite: supabase/schema.sql has already been run against this
-- database (it is the baseline — see supabase/migrations/README.md).
--
-- Safe to re-run: everything below is guarded. The schema is deliberately
-- NOT exposed through PostgREST (only `public` and `graphql_public` are),
-- and no API role is granted anything on it — it is bookkeeping for
-- operators running migrations in the SQL editor.

begin;

create schema if not exists supabase_migrations;

revoke all on schema supabase_migrations from public, anon, authenticated;

create table if not exists supabase_migrations.applied_migrations (
  version text primary key,
  name text not null default '',
  applied_at timestamptz not null default now()
);

-- No API role has a grant on this table, and the schema isn't exposed through
-- PostgREST. RLS is enabled with no policies as a second belt: even if the
-- table were somehow reached through the API, it would return nothing. The
-- table owner (whoever runs migrations in the SQL editor) still sees it.
alter table supabase_migrations.applied_migrations enable row level security;

-- The baseline is always applied before any migration file is, so record it
-- now. This row also exists so that a later switch to the Supabase CLI can
-- see that the schema came in as a baseline rather than as numbered files.
insert into supabase_migrations.applied_migrations (version, name)
values ('0000_baseline', 'supabase/schema.sql')
on conflict (version) do nothing;

-- This migration records itself last, per the convention in README.md.
insert into supabase_migrations.applied_migrations (version, name)
values ('20261019000000', 'migration_tracking')
on conflict (version) do nothing;

commit;
