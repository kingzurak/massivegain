# MassiveGain.ng — Pre-Flight E2E Test Script

Since production shares the same Supabase project as everything tested
across Milestones 1–9, **every step below is a real action against real
data** — there is no separate sandbox. Two consequences, worth deciding
on purpose rather than by accident:

- **Use a real, clearly-labelled test account** for this run (e.g.
  `preflight-test+2026-10-07@yourdomain.com`), not a shared/ambiguous one.
- **All the test data from the whole build (M1–M9) is already live in
  this database** — test users, test orders, test suspended accounts,
  test commissions. It's not dangerous (RLS already scopes everyone to
  their own data), just untidy. Optional cleanup query at the bottom of
  this file if you want a fresh start before announcing launch.

Each step: **what to do → what you should see → how to independently verify it.**

---

## 1. Signup → login → session persistence

1. `/register` with no `?ref=` param → create the test account.
2. If email confirmation is on: confirm via the email, then `/login`. If off: you should land on `/dashboard` immediately.
3. Refresh `/dashboard` → confirm you're still logged in (session persists).
4. Log out (top bar) → confirm you land on `/` and are actually signed out (try `/dashboard` directly → should redirect to `/login`).
5. **Verify in SQL**: `select id, email, role, status, referral_code from profiles where email = 'your-test-email';` → one row, `role = 'customer'`, `status = 'active'`, `referral_code` populated.

## 2. Referral signup path

1. From the account above, copy the referral link at `/dashboard/referrals`.
2. Open it in a private/incognito window → confirm the register page shows the "You were invited" message.
3. Create a **second** test account through that link.
4. **Verify in SQL**: `select referred_by from profiles where email = 'second-test-email';` → should equal the first account's `id`.

## 3. Wallet funding (Paystack)

1. As the second test account, `/dashboard/wallet` → fund a small amount.
2. Complete payment with a Paystack test card if still on `sk_test_...`, or a real small amount if you've already switched to live keys.
3. Confirm redirect back shows `funding=success` and the balance updated.
4. `/dashboard/transactions` → confirm a `funding` row with `status = success`.
5. **If you have webhook delivery configured**: check Paystack's dashboard → that event → confirm it shows delivered, not just the browser callback.

## 4. Order placement + commission payout

1. As the second account, `/dashboard/services` → order something, with a real link and quantity within range.
2. Confirm wallet balance drops by the exact order amount, order appears in `/dashboard/orders` as **Pending**.
3. Switch to the **first** account (the referrer) → `/dashboard/referrals` → confirm "Total commissions earned" increased by 5% of that order, and it appears in the commission history.
4. **Verify in SQL**: `select * from referral_commissions where referred_user_id = '<second account id>';` → one row, `status = 'paid'`.

## 5. Admin fulfilment

1. Log in as admin → `/admin/orders` → find the order from Step 4.
2. Click **Fulfil** → enter an External Order ID, Start Count, confirm the Link field is pre-filled from what the customer submitted → Save.
3. Change status Pending → Processing → Completed via the dropdown.
4. Confirm the customer sees the updated status on `/dashboard/orders`.

## 6. Order cancellation + refund + commission reversal

1. Place a **new** order as the second account (don't reuse the completed one — cancelling a completed order should be rejected).
2. As admin, cancel it via the status dropdown.
3. Confirm: customer's wallet balance goes back up by the full order amount; referrer's commission is reversed (check `/dashboard/referrals` → commission history shows a negative entry).
4. **Verify in SQL**: `select status from referral_commissions where order_id = '<that order id>';` → `reversed`.

## 7. Suspension enforcement

1. As admin, suspend the second test account.
2. From that account's existing browser session (don't log out first), try navigating to `/dashboard` → confirm you're redirected to `/suspended` and actually signed out (not just shown a message with the session intact).
3. Try logging back in with that account's credentials → should still work (suspension blocks access to the dashboard, not login itself) and immediately redirect to `/suspended` again.
4. Reactivate the account from `/admin/users` → confirm normal access returns.

## 8. Access control spot checks

1. While logged in as the (non-admin) second account, try `/admin` directly → confirm redirect to `/dashboard`.
2. In the browser console on that account, try `await supabase.rpc('place_order', {...})` directly → confirm it fails with a permission error (closed in Milestone 9).
3. Try the same for `cancel_order_with_refund` → confirm `not_authorized` outcome, not an actual cancellation.

## 9. Rate limiting

1. As any logged-in customer, submit 6 orders back-to-back within 10 seconds → confirm the 6th returns "Too many requests."
2. Same test against "Continue to Paystack" on the wallet page.

## 10. Error boundaries (quick re-confirmation from Milestone 9)

1. Trigger a real error on any dashboard or admin route (easiest: temporarily rename an env var, reload, then put it back) → confirm you see the branded error card with working **Try again**, not a blank page or Next.js's default error screen.

---

## Optional: clean up accumulated test data before launch

Only run this once you're confident you don't need any of it — it's not
reversible. Review each table's contents first; don't run blind.

```sql
-- Review first:
select id, email, created_at from auth.users order by created_at;

-- Then, to remove a specific test account and everything tied to it
-- (cascades through profiles/wallets/orders/transactions/commissions
-- via the on-delete-cascade foreign keys already in the schema):
-- delete from auth.users where email = 'the-test-email-to-remove';
```
