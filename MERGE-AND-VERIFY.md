# Ready-to-run: merge, deploy, verify

Everything below is copy-paste. Step 1 is yours (merge + apply SQL); the rest
is a plain HTTP check you can run from any terminal.

Since `provider-bestclout` is now **4 commits ahead** of `main`, one merge
carries all of it:

| commit | brings |
| --- | --- |
| `c2a39d7` | migrations numbered 1, 2 instead of long timestamps |
| `a69cbad` | imported bestclout services activate on import |
| `8b2a0af` | `/robots.txt`, `/sitemap.xml`, `app/icon.svg` |
| `88dc751` | `3_order_integrity.sql` + `verify.sql` |

## 1. Merge and apply (you)

1. Merge `provider-bestclout` → `main` on GitHub; Vercel redeploys from `main`.
2. Supabase → SQL Editor → apply anything the ledger is missing:
   ```sql
   select version, name, applied_at
   from supabase_migrations.applied_migrations
   order by version;
   ```
   Paste **`3_order_integrity.sql`** (safe to re-run) if `3` isn't listed.
3. SQL Editor → paste **`supabase/verify.sql`** and compare each result set
   with its "expected" note.

## 2. Deployed-URL checks (run after step 1)

```powershell
$site = "https://massivegain.vercel.app"
foreach ($u in @("/","/services","/login","/register","/robots.txt","/sitemap.xml","/icon.svg")) {
  try { $r = Invoke-WebRequest -Uri "$site$u" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        "$([int]$r.StatusCode)  $u" }
  catch { "ERR  $u :: $($_.Exception.Message)" }
}
(Invoke-WebRequest -Uri "$site/robots.txt" -UseBasicParsing).Content      # sitemap: line must point at the real domain
(Invoke-WebRequest -Uri "$site/sitemap.xml" -UseBasicParsing).Content | Select-String 'https://'
```

Expected: `/robots.txt`, `/sitemap.xml`, `/icon.svg` all **200** (they 404 today
because those commits aren't deployed yet), and the `sitemap:` / `<loc>` URLs
use `https://massivegain.vercel.app`, not `localhost`.

## 3. Still blocked on funding, not code

These can only be exercised once bestclout has a balance and a customer wallet
is funded — until then an upstream order stays `pending` with no external id,
which is the expected failure path:

- [ ] Top up bestclout, then `/admin/providers` → Sync; order a real service,
  confirm `/admin/orders` shows provider `bestclout` + an external order id.
- [ ] Paystack dashboard → Webhook URL → `https://massivegain.vercel.app/api/paystack/webhook`.
- [ ] Fund a test customer ₦1,000 → place a cheap Default order → Sync again →
  check the completed / cancelled+“refund due” paths.
