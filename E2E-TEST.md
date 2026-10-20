# End-to-end order test

One real order, from the customer's wallet all the way to bestclout and back.
Run this after a deploy, once bestclout has a non-zero balance — at ₦0 the
order is created but never handed upstream, which is the one failure this
plan can't tell apart from a broken integration.

Do it in order. Each step says what to do and what you should see. Stop at
the first step that doesn't match and use "If it fails" at the end.

- Admin: `princeelancie@gmail.com`
- A test customer you control (a spare account, **not** `kingzurak` or
  `nnamdi` — this spends real money out of their wallet)
- Production: `https://massivegain.vercel.app`

---

## 0. Preconditions

- [ ] bestclout balance is **non-zero**. Check `/admin/providers` — the
      balance card must show a positive NGN figure, not `0`. Top up in the
      bestclout panel first if it reads zero.
- [ ] You can log in to both the admin account and the test customer.
- [ ] Note today's date; you'll look for it in timestamps below.

## 1. Pick a cheap service and read its numbers

- [ ] As admin, open **`/admin/services`**.
- [ ] Filter/sort to bestclout services **with a provider cost** (the Cost
      column is filled in). Pick one with the **lowest Cost per 1,000**, so
      the test order costs a few naira, not thousands.
- [ ] Click **Edit** on it and write down three numbers from the modal:
  - **Provider cost per 1,000 (₦)** — call it `C`
  - **Our markup (%)** and **Our flat fee (₦/1,000)** — the resolved values
    (the modal shows what's used when the field is blank)
  - **Price per 1,000** — the grey read-out, call it `P`. Confirm you
    **cannot edit it** (it's read-only because a cost is set). Confirm the
    read-out is roughly `C × (1 + markup/100) + flat`.
- [ ] Also note the service's **Min quantity** — call it `Q` (you'll order
      exactly `Q` units, the cheapest legal order).
- [ ] Close the modal without saving.

Expected order cost: `P × Q / 1000` naira (call it `ORDER_COST`). Round it
up to the nearest ₦100 mentally; you'll fund a little more than that.

## 2. Fund the test customer's wallet

- [ ] Log in as the test customer, open the wallet / funding page, and start
      a Paystack payment for a small amount (e.g. **₦1,000**) — enough to
      cover `ORDER_COST`.
- [ ] Complete the Paystack test/live payment and wait for the redirect back.
- [ ] The dashboard balance should rise by the amount **minus** any Paystack
      fee, and the funding should appear in the wallet/transactions history.

The webhook is what credits the wallet, so this step proves two things at
once: the payment works, **and** the webhook URL is set correctly in the
Paystack dashboard. If the balance doesn't move, see "If it fails".

## 3. Place the order

- [ ] Still as the customer, go to **`/services`**, find the exact service
      you picked (search by name), open its order form.
- [ ] Confirm the card shows the **final price** (`P` per 1,000) — the
      customer must never see the provider cost.
- [ ] Enter a shareable **link** for that platform (a real public post/profile
      URL — bestclout may reject an obviously bogus one) and quantity `Q`.
- [ ] Place the order. The wallet should drop by `ORDER_COST` and you should
      get an order number.
- [ ] As the customer, open **`/dashboard/orders`** (or the orders list).
      The new order should be there, status **processing** or **pending**.

## 4. Confirm it reached bestclout

- [ ] As **admin**, open **`/admin/orders`** and find the order by number.
- [ ] You should see:
  - **provider = `bestclout`**
  - an **external order id** (a numeric bestclout id) — this is the proof it
    was handed upstream
  - a **provider cost** figure equal to `C × Q / 1000`
  - status **processing**
- [ ] Cross-check by **`/admin/providers`** → the balance card is now lower
      (bestclout charged you the provider cost). If the balance didn't move
      but the external id is set, the order may still be queued upstream;
      re-check in a minute.

If the order is stuck at **pending with no external id**, the dispatch failed
(usually: zero balance, bad `BESTCLOUT_API_KEY`, or an unmapped
`provider_service_id`). That's the failure path — the order stays pending for
manual handling and no money is lost, but the integration didn't fire.

## 5. Watch it complete (Sync)

bestclout has no webhooks — status is polled. Two ways to poll:

- [ ] Quickest: **`/admin/providers` → Sync order statuses**. It should
      report how many orders it checked and updated.
- [ ] Background: the Vercel cron `/api/cron/sync-orders` runs daily at
      `03:00` (Hobby-plan limit). You can also trigger it by hand:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://massivegain.vercel.app/api/cron/sync-orders`
- [ ] Pick a service whose delivery is **fast and finishable for `Q` units**
      (a small real order should complete within minutes). After
      **Sync**, the order flips to **completed** and completed orders become
      terminal (they can no longer be cancelled — that's migration 3).

If completion takes longer than the test window, that's fine — the point is
that a **Sync** run updates `provider_status` / `provider_synced_at` without
error. You don't have to wait for a real completion to prove the wiring.

## 6. Prove the refund path (provider-cancelled)

This is the safety net: if bestclout cancels, the customer must get their
money back.

- [ ] Place **one more** cheap order (repeat steps 3–4) on a service, or
      reuse a still-`processing` order.
- [ ] Trigger a cancel **on bestclout's side** if you can (e.g. an order
      bestclout rejects/cancels), then run **Sync order statuses**.
- [ ] In `/admin/orders` the order should be flagged **"refund due"**
      (`refund_required = true`), **not** silently completed.
- [ ] Bestclout's sync never refunds by itself, by design. As admin, open
      that order and **cancel it** — this calls
      `cancel_order_with_refund`, which returns the money to the customer's
      wallet **and** reverses the referrer's commission.
- [ ] Confirm the customer's wallet balance goes back **up** by `ORDER_COST`.
      (There's a deliberate rule that a **completed** order can't be
      cancelled — so only test this on a non-completed one.)

If you can't force a real bestclout cancellation, this path can still be
eyeballed: the "refund due" flag is set purely by `mapProviderStatus`
returning `cancelled`, and the button calls the same RPC used above.

## 7. Sanity-check the money

- [ ] **Company margin:** in `/admin/orders`, `provider_cost` should be less
      than the amount the customer paid for the same order. The difference
      is our money — this is the guarantee the cost+charge model is meant to
      give, so confirm it holds for a real order, not just the formula.
- [ ] **Referral:** if the test customer was referred, the referrer's
      commission (5% by default) should have been credited when the order
      was placed, and reversed on a refund.
- [ ] **No double spend:** the wallet never goes negative, and a refund
      never happens for an order that was never charged.

---

## If it fails

| Symptom | Most likely cause | Check |
| --- | --- | --- |
| Wallet unchanged after Paystack | Webhook URL/secret wrong in Paystack dashboard | Set `https://massivegain.vercel.app/api/paystack/webhook`; check Vercel logs for a 401 on the webhook |
| Order created but **pending, no external id** | bestclout balance is 0, bad `BESTCLOUT_API_KEY`, or `provider_service_id` missing on the service | `/admin/providers` balance; Vercel logs for `[orders] provider dispatch failed` |
| Can't place order at all, 4xx | Out of balance, quantity outside min/max, or bad link | Error text on the form; re-check `Q` and a real `https://` link |
| Sync does nothing | `CRON_SECRET` mismatch, or nothing in `pending`/`processing` | Manual `curl` in step 5; Vercel logs for `[sync]` |
| Refund didn't credit | Order already `completed` (terminal by design) | Only cancel non-completed orders |
| Cost/price look wrong | A stale `provider_rate`, or a service with no cost | `/admin/services` Cost vs Price vs our charge columns |

## Cleanup

- [ ] Note the order numbers you created so they're not mistaken for real
      customer orders later.
- [ ] If any test order is still `pending` with no external id, cancel it as
      admin so the customer's wallet is refunded.
