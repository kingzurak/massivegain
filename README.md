# MassiveGain.ng

Nigerian digital marketing and social-media promotion platform: customers
fund a naira wallet, order marketing services from a catalogue, and track
every order from a dashboard. Admins manage services, orders, users and
settings from a separate admin area.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the values (see DEPLOYMENT.md)
npm run dev
```

Then open http://localhost:3000

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**
- **Supabase** — authentication, Postgres database, and Row Level Security.
  RLS is enabled on every table and is the authorization boundary; see
  `supabase/schema.sql`.
- **Paystack** — wallet funding. Every payment is verified server-side
  (webhook HMAC + callback re-verification) before the wallet is credited.
- **Upstash Redis** — rate limiting on the API routes.
- Provider fulfilment abstraction in `lib/providers` (manual fulfilment
  today).

Design tokens (colors, fonts) live as CSS variables in `app/globals.css`
and are wired into `tailwind.config.ts` — change them there to re-theme the
whole app centrally.

## Routes

Public:

- `/` — marketing home page
- `/services` — public service catalogue (read-only; ordering requires login)
- `/login`, `/register` (accepts `?ref=` referral links), `/suspended`

Customer dashboard (`/dashboard`, requires login):

- `/dashboard` — summary
- `/dashboard/services` — catalogue and order placement
- `/dashboard/orders`, `/dashboard/transactions`
- `/dashboard/wallet` — fund with Paystack
- `/dashboard/referrals` — referral link and commission history
- `/dashboard/profile`

Admin (`/admin`, requires the `admin` role):

- `/admin`, `/admin/orders`, `/admin/services`, `/admin/users`,
  `/admin/providers`, `/admin/transactions`, `/admin/statistics`,
  `/admin/settings`

API routes (server-only, all rate limited):

- `/api/orders/place`
- `/api/paystack/initialize`, `/api/paystack/callback`, `/api/paystack/webhook`
- `/auth/signout`, `/auth/suspended`

## Environment variables

See `.env.example` for the full list. `DEPLOYMENT.md` documents each
variable, where to get it, and how to scope it per Vercel environment.
Never commit `.env.local`.

## Database

`supabase/schema.sql` is the complete, idempotent schema: tables, RLS
policies, and the SECURITY DEFINER functions that own every wallet, order
and transaction write. Run it top-to-bottom in the Supabase SQL editor for
a new project.

## Deployment & testing

- `DEPLOYMENT.md` — full production setup checklist
- `PREFLIGHT.md` — end-to-end test script (auth, funding, orders,
  commissions, suspension, access control, rate limits)
- `POST-DEPLOY.md` — post-deploy smoke test and rollback plan
