# Database migrations

`supabase/schema.sql` is the **baseline**: the complete, idempotent schema as
it stood when this directory was introduced. A brand-new project is
provisioned by pasting that whole file into the Supabase SQL editor.

Everything *after* that baseline lives here, one change per file, applied in
filename order and recorded in the database so it's always clear which
changes any given project already has.

## Naming

```
<N>_short_description.sql
```

e.g. `1_migration_tracking.sql`, `2_bestclout.sql`, `3_add_batch_status_column.sql`.

Files are applied in **ascending numeric order of `<N>`** (1, 2, 3 … — not
textual filename order, so `10_...` correctly comes after `9_...`). This is a
deliberate tradeoff: short, readable names over Supabase-CLI-compatible
timestamp names. Applying is manual in the SQL editor, as described below.

## Rules

1. **Append-only.** Never edit a migration that has been applied to any
   environment — add a new file that corrects it instead.
2. **Idempotent.** Every file must be safe to run twice (`if not exists`,
   `or replace`, `drop ... if exists` before `create`, `on conflict do
   nothing`), same as the baseline. Someone re-pasting is not a mistake to
   be punished.
3. **One transaction.** Wrap the body in `begin; ... commit;` so a failure
   halfway through leaves nothing applied.
4. **Record itself.** End with an insert into
   `supabase_migrations.applied_migrations` for its own version (the number
   in its filename). The table is created by `1_migration_tracking.sql`.
5. **Schema only.** Functions, tables, policies, grants — never customer
   data, never secrets.

## Applying

For a project that already has the baseline (i.e. `schema.sql` has been run):

1. Open the Supabase SQL editor.
2. If the tracking table doesn't exist yet, run
   `1_migration_tracking.sql` first — it creates the table and records the
   baseline as applied.
3. List what's already applied:
   `select version from supabase_migrations.applied_migrations order by version;`
4. Paste every file whose number is **not** in that list, lowest first,
   one file per query.

For a brand-new project: run `supabase/schema.sql`, then
`1_migration_tracking.sql`, then any later files.

## Why this exists

Before this, every change was appended to the bottom of one ever-growing
`schema.sql` and applied by re-pasting the whole file. That works, but it
gives no record of which changes a database already has, no ordering, and
nothing to review or roll back in isolation. This directory fixes that while
keeping the single-paste baseline for fresh projects.
