# MassiveGain.ng — Production Deployment Checklist

Every environment variable below was confirmed by grepping the actual
source (`process.env.*` usage) plus the Upstash SDK's `Redis.fromEnv()`,
which reads two more that never appear as a literal `process.env.X` in
our own code. This list is complete — nothing in the app reads an env
var that isn't here.

## 1. Environment variables

| Variable | Exposed to browser? | Dev value | Production value | Where to get it |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your dev/test Supabase project URL | Your **production** Supabase project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Dev project's `anon` `public` key | Production project's `anon` `public` key | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — server only** | Dev project's `service_role` key | Production project's `service_role` key | Same page. This key bypasses every RLS policy in the app — treat it like a root password |
| `PAYSTACK_SECRET_KEY` | **No — server only** | `sk_test_...` | `sk_live_...` | Paystack dashboard → Settings → API Keys & Webhooks |
| `NEXT_PUBLIC_SITE_URL` | Yes | `http://localhost:3000` | `https://<your-production-domain>` | — |
| `UPSTASH_REDIS_REST_URL` | **No — server only** | Your Upstash database's REST URL | Same, or a separate prod database (see below) | Upstash dashboard → your database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | **No — server only** | Matching REST token | Same | Same page |
| `BESTCLOUT_API_KEY` | **No — server only** | Your bestclout API key | Same key, or a separate bestclout account for production | bestclout account panel → API |
| `CRON_SECRET` | **No — server only** | Any long random string (e.g. `openssl rand -hex 32`) | A **different** long random string | Generate yourself. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` to `/api/cron/sync-orders`; without it that route refuses to run |

## 2. One decision to make before anything else: separate Supabase projects?

Every milestone so far has run against **one** Supabase project. Before
going live, decide:

- **Separate dev/prod projects (recommended)** — your test accounts,
  test orders, and test wallet balances never touch real customer data,
  and you can run risky migrations against dev first. Means re-running
  the **entire** `supabase/schema.sql` top-to-bottom against the new
  production project (it's written to be idempotent — safe to run as
  one big paste).
- **One project for both** — simpler, but every test signup/order from
  development stays in the same database your real customers use.

I can't make this call for you — it's a cost/complexity tradeoff, not a
technical one. Whichever you choose, the steps below assume you know
which Supabase project is "production."

## 3. Supabase production setup

- [ ] Run the complete `supabase/schema.sql` against the production project (SQL Editor → paste the whole file)
- [ ] **If this database already exists**, don't re-paste everything blindly — run `supabase/migrations/1_migration_tracking.sql` once to create the ledger, then apply only the files listed in `supabase/migrations/README.md` that aren't yet in `supabase_migrations.applied_migrations`.
- [ ] **Authentication → URL Configuration** → set **Site URL** to your real production domain, and add it to **Redirect URLs**. This is the single most commonly missed step — if skipped, email confirmation and any auth redirect links will point back to `localhost` for real users.
- [ ] **Authentication → Providers → Email** → confirm your choice on email confirmation (on/off) matches what you tested
- [ ] Promote your own account to admin via SQL Editor (documented in `schema.sql` comments near `protect_profile_role`) — you need at least one working admin on the production database, separate from any dev-project admin

## 4. Paystack production setup

- [ ] Paystack account fully verified for live payments (business verification has its own lead time — start this early if not already done)
- [ ] Switch `PAYSTACK_SECRET_KEY` to the `sk_live_...` key
- [ ] Dashboard → Settings → API Keys & Webhooks → **Webhook URL** → `https://<your-production-domain>/api/paystack/webhook` (this is almost certainly still pointing at a test/ngrok URL from development)
- [ ] Place one small real-money test order end-to-end after deploying, before announcing launch

## 5. Upstash production setup

Lower stakes than Supabase/Paystack — rate-limit keys are scoped per
user/IP, so sharing one Redis database between dev and prod is low-risk
if you'd rather not pay for two. Separate is still cleaner if cost isn't
a concern.

## 6. Vercel environment variable scoping

Vercel has three scopes per variable: **Production**, **Preview**, **Development**.
Set them deliberately rather than applying one value to all three:

- [ ] **Project → Settings → General → Root Directory** is **empty** (`. /`
  i.e. the repository root). The app used to live in a `massivegain/`
  subfolder; it now sits at the repository root, so a leftover
  `massivegain` Root Directory setting would make every deploy fail.

- [ ] **Production** scope: live Paystack key, production Supabase project, production `NEXT_PUBLIC_SITE_URL`
- [ ] **Preview**/**Development** scopes: test Paystack key, dev Supabase project — so a preview deployment (e.g. from a pull request) can never move real money or touch real customer data
- [ ] `NEXT_PUBLIC_SITE_URL` in Preview: if left unset, `/api/paystack/initialize` and `/dashboard/referrals` both now fall back to deriving the URL from the actual incoming request (not a hardcoded guess — see note below), so this is safe to leave blank for Preview if that's more convenient

## 7. A bug this audit found and fixed

`app/dashboard/referrals/page.tsx` fell back to a **hardcoded**
`https://massivegain.ng` if `NEXT_PUBLIC_SITE_URL` was ever missing —
a guess from when the project started, not a confirmed owned domain.
If that env var had been misconfigured in production, every
customer's referral link would have silently pointed at a domain you
may not even own. Fixed to derive the real request origin from headers
instead, matching the pattern already used in the Paystack initialize
route.

## 8. Secret hygiene, before you flip the switch

- [ ] `.env.local` was never committed (already in `.gitignore` since Milestone 1 — worth a final `git log --all --full-history -- .env.local` to be sure)
- [ ] If `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` or `BESTCLOUT_API_KEY` were ever pasted into a chat, ticket, or shared doc during development, rotate them before launch
- [ ] Confirm no `console.log` anywhere prints a secret (the Paystack/webhook routes log error *messages* on failure, never key values — worth a final skim if you've added any debug logging of your own)

## 9. bestclout fulfilment provider

`bestclout.com` is the first real fulfilment provider (the `manual` stub
still exists for services that aren't mapped). Its panel currency is
**NGN**, so no FX conversion exists anywhere. A service's sell price is
derived from what bestclout charges plus **our charge**: cost × (1 + markup%)
+ flat fee, where the markup and flat fee are per-service overrides or the
global defaults in `system_settings` (`bestclout_markup_percent`,
`default_charge_flat`).

- [ ] Set `BESTCLOUT_API_KEY` and `CRON_SECRET` in Vercel (Production; a *different* `CRON_SECRET` for Preview/Development if you set one there)
- [ ] Confirm the `vercel.json` cron is registered — Project → **Cron Jobs** should list `/api/cron/sync-orders`. The checked-in schedule is daily (`0 3 * * *`) because Hobby plans restrict cron frequency; raise it on a Pro plan if you want faster status updates. The admin **Providers → Sync order statuses** button works regardless.
- [ ] In `/admin/providers`, confirm the balance reads (it's in NGN), set the default charge (markup % and/or flat fee), and import the catalogue. Imported services go live immediately at that charge; adjust a service's cost or charge anytime in `/admin/services`.
- [ ] Only **Default**-type bestclout services auto-fulfil. Custom Comments / Comment Likes / Comment Replies / Package services are never imported or sent upstream — fulfil those by hand in `/admin/orders`.
- [ ] When bestclout cancels an order, the sync flags it **“refund due”** in `/admin/orders`. It does **not** auto-refund (the refund function requires an admin session) — open the order and cancel it there to refund the customer.
