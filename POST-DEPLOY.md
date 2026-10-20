# MassiveGain.ng — Post-Deployment Verification Checklist

Run this immediately after the first production deploy, and again after
any deploy that touches auth, payments, or the database schema.

## 1. Immediate smoke test (on the real production URL, not localhost)

- [ ] `https://<your-domain>` loads, HTTPS padlock is valid (Vercel issues this automatically on a connected domain — if it's missing, the domain's DNS isn't fully propagated/connected yet)
- [ ] `/services` loads and lists your real services
- [ ] `/register` → create one real throwaway account → confirm it completes without error
- [ ] `/login` with that account → reaches `/dashboard`
- [ ] Log in as admin → `/admin` loads, shows real counts

This is a 5-minute confidence check, not the full test — that's `PREFLIGHT.md`. The point here is catching anything that only breaks in the *deployed* environment (env var typo, wrong Supabase project, domain misconfiguration) that would never show up locally.

## 2. The setting most likely to have been missed

- [ ] Supabase dashboard → **Authentication → URL Configuration** → **Site URL** and **Redirect URLs** actually show your production domain, not `localhost:3000`. If this was skipped, signup/confirmation emails work but every link in them points at `localhost` for real users — easy to miss because *your own* testing session still works fine (you're already logged in), it only breaks for a brand new user following an email link.

## 3. Paystack — confirm the webhook is actually reaching production

- [ ] Paystack dashboard → Settings → Webhooks → confirm the URL shown is `https://<your-domain>/api/paystack/webhook`, not an old ngrok/test URL
- [ ] Fund a small amount through the real flow → Paystack dashboard → that transaction's **Webhook** tab → confirm a delivery attempt shows **200 OK** against your production domain
- [ ] If it shows a failed delivery: check Vercel's function logs for that route (see below) for the actual error before re-sending

## 4. Where production errors actually show up

There's no external error-tracking service wired into this project (no Sentry/equivalent) — that's a real gap worth knowing about, not something quietly handled. Right now, your only visibility is:

- [ ] Vercel dashboard → your project → **Logs** (or **Functions** tab) → filter by route — every `console.error(...)` already in the API routes (`/api/orders/place`, `/api/paystack/initialize`, `/api/paystack/callback`, `/api/paystack/webhook`) lands here
- [ ] Bookmark this now, before you need it during an actual incident

If you later want proactive alerting (not just "check logs when something's reported"), that's a real follow-up worth scoping deliberately rather than bolting on — flagging it rather than adding it silently.

## 5. SEO/asset basics — now in place

`app/robots.ts`, `app/sitemap.ts` and `app/icon.svg` exist, so `/robots.txt`,
`/sitemap.xml` and the favicon are served automatically. Both build absolute
URLs from `NEXT_PUBLIC_SITE_URL`, so:
- [ ] Confirm `NEXT_PUBLIC_SITE_URL` is set to the production domain in the
  Vercel **Production** scope, then open `/robots.txt` and `/sitemap.xml` and
  check the URLs point at your real domain rather than `localhost`.
- [ ] `/dashboard`, `/admin`, `/api` and `/auth` are disallowed in `robots.txt`;
  the pages themselves already require auth, this just keeps them out of
  indexes.

## 6. Database migrations actually applied

The code deploy and the database are two separate steps — a green Vercel
deploy says nothing about whether the schema matches. After any deploy that
shipped a file under `supabase/migrations/`:

- [ ] Supabase SQL Editor → run
  `select version, name, applied_at from supabase_migrations.applied_migrations order by version;`
  — it should list every migration file, including the newest one.
- [ ] Paste each migration file that is **missing** from that list, lowest
  number first, one file per query (see `supabase/migrations/README.md`).
- [ ] Run `supabase/verify.sql` (read only) and check each result set against
  its "expected" note — grants, the single 5-argument `place_order`, RLS on
  every table, the `guard_order_integrity` trigger, and the applied list.

## 7. Rollback plan — know this *before* you need it

- [ ] **Code**: Vercel keeps every deployment — Project → Deployments → pick a previous one → "Promote to Production" rolls back instantly, no rebuild needed.
- [ ] **Database is NOT automatically rolled back with it.** If a deploy that included a schema change causes a problem, rolling back the Vercel deployment reverts the *code* but not the *database* — the old code would now be running against a newer schema than it expects. Run `select version, name, applied_at from supabase_migrations.applied_migrations order by version;` to see exactly which migrations this database has, then check the matching files under `supabase/migrations/` (and the baseline `supabase/schema.sql`) before deciding what needs reverting — rarely as simple as a single `DROP`, and never edit an already-applied migration file, add a new one.

## 8. Ongoing — what to periodically check, not just once

- [ ] **Supabase dashboard → Usage** — database size, API requests, auth users — against your plan's limits, especially once real traffic starts
- [ ] **Paystack dashboard → Transactions** — periodically reconcile against your own `transactions` table (`select sum(amount) from transactions where type = 'funding' and status = 'success';`) to catch anything that settled on Paystack's side but didn't make it into your database
- [ ] **Upstash dashboard** — request volume against your plan's quota
- [ ] **bestclout balance** (`/admin/providers`) — orders fail upstream when the provider account runs dry; top it up before that
- [ ] **bestclout rates** — a provider rate can change upstream without you noticing, and **Import only adds new services** (it skips ones already mapped), so it never refreshes an existing price. Check the Cost and Margin columns in `/admin/services`; correct a stale rate via **Edit → Provider cost per 1,000**, then adjust the sell price if the margin drifted.
- [ ] **Orders flagged “refund due”** (`/admin/orders`) — the sync flags these when bestclout cancels an order, but refunding the customer is still an admin action
- [ ] **Vercel → Cron Jobs** — confirm `/api/cron/sync-orders` is running (and succeeding) on its schedule

## 9. Launch sign-off

All three documents together are the full Milestone 10 deliverable:
- [ ] `DEPLOYMENT.md` — every environment variable correctly set in Vercel
- [ ] `PREFLIGHT.md` — all 10 flows walked through and verified
- [ ] `POST-DEPLOY.md` (this file) — sections 1–3 completed on the real production URL, section 6 confirmed against the database

Once all three are checked off, the app is ready to announce.
