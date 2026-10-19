# MassiveGain.ng

Nigerian digital marketing and social-media promotion platform.

## Milestone 1 — Foundation + brand design (this build)

This milestone contains **UI and layout only**. There is no real
authentication, database, payments, or fulfilment logic yet — all data on
screen comes from `lib/mock-data.ts` and is clearly placeholder/demo data.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## What's included

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Design tokens (colors, fonts) as CSS variables in `app/globals.css`,
  wired into `tailwind.config.ts` — change the values there to re-theme
  the whole app centrally
- Public pages: `/`, `/services`, `/login`, `/register`
- Customer dashboard shell: `/dashboard`, `/dashboard/orders`,
  `/dashboard/wallet`, `/dashboard/transactions`, `/dashboard/profile`
- Admin shell: `/admin`, `/admin/orders`, `/admin/services`,
  `/admin/users`, `/admin/providers`, `/admin/transactions`,
  `/admin/statistics`
- Reusable components in `components/ui` (Button, Card, Badge, Table,
  Modal, LoadingState, EmptyState, ErrorState, PageHeader, FormField)
  and `components/layout` (Navbar, Footer, Sidebar, MobileNav, TopBar)

## Not included yet (future milestones)

- Supabase Auth, database schema, and Row Level Security
- Paystack wallet funding and payment verification
- Real order placement and status updates
- The provider fulfilment abstraction layer
- Any environment variables (see `.env.example` for what's coming)
