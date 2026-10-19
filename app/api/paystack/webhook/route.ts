import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { settleFundingReference } from "@/lib/paystack";
import { paystackWebhookLimiter, rateLimitResponse, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Paystack server-to-server notification. Works even if the customer
 * closes their browser before the callback page loads.
 * Authenticity is proven by an HMAC-SHA512 signature of the raw body,
 * made with our secret key.
 *
 * Rate limit is checked before anything else, including signature
 * verification — the cheapest possible rejection for volume abuse. The
 * threshold is deliberately generous so it never interferes with a
 * legitimate Paystack retry; a 429 here just makes Paystack retry later,
 * same as any other non-2xx response.
 */
export async function POST(request: NextRequest) {
  const { success, reset } = await paystackWebhookLimiter.limit(clientIp(request));
  if (!success) return rateLimitResponse(reset);

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("[paystack] webhook: PAYSTACK_SECRET_KEY missing");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text(); // must be the exact raw text for the signature
  const signature = request.headers.get("x-paystack-signature") ?? "";

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    try {
      await settleFundingReference(event.data.reference);
    } catch (err) {
      // Transient failure: a non-200 makes Paystack retry the webhook later.
      console.error("[paystack] webhook settle failed", err);
      return NextResponse.json({ error: "Try again" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
