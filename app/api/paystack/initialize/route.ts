import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveSession } from "@/lib/auth";
import { initializePaystackTransaction } from "@/lib/paystack";
import { walletFundingLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { MIN_DEPOSIT_NAIRA as MIN_NAIRA, MAX_DEPOSIT_NAIRA as MAX_NAIRA } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 1. Must be a logged-in, active user (verified server-side, not from the
  // request body). Suspended accounts must not start new payments even if
  // their login session is still technically valid.
  const session = await getActiveSession();
  if (!session.ok) {
    return NextResponse.json(
      {
        error:
          session.reason === "unauthenticated"
            ? "Please log in to fund your wallet."
            : "This account can't fund a wallet.",
      },
      { status: session.reason === "unauthenticated" ? 401 : 403 }
    );
  }

  const { user } = session;
  if (!user.email) {
    return NextResponse.json({ error: "Please log in to fund your wallet." }, { status: 401 });
  }

  const { success, reset } = await walletFundingLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse(reset);
  }

  // 2. Validate the amount on the server — never trust the browser.
  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount < MIN_NAIRA || amount > MAX_NAIRA) {
    return NextResponse.json(
      { error: `Enter a whole amount between ₦${MIN_NAIRA.toLocaleString()} and ₦${MAX_NAIRA.toLocaleString()}.` },
      { status: 400 }
    );
  }

  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[paystack] missing server environment variables");
    return NextResponse.json({ error: "Payments aren't available right now." }, { status: 500 });
  }

  // 3. Record a PENDING transaction first. Only the server can write this table.
  const reference = `mg_${randomUUID().replace(/-/g, "")}`;
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("transactions").insert({
    user_id: user.id,
    type: "funding",
    status: "pending",
    amount,
    reference,
    provider: "paystack",
    description: "Wallet funding via Paystack",
  });

  if (insertError) {
    console.error("[paystack] could not create pending transaction", insertError.message);
    return NextResponse.json({ error: "Could not start the payment. Try again." }, { status: 500 });
  }

  // 4. Ask Paystack for a payment page.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const init = await initializePaystackTransaction({
      email: user.email,
      amountNaira: amount,
      reference,
      callbackUrl: `${siteUrl}/api/paystack/callback`,
    });
    return NextResponse.json({ authorizationUrl: init.authorization_url });
  } catch (err) {
    console.error("[paystack] initialize failed", err);
    await admin.rpc("mark_funding_failed", { p_reference: reference });
    return NextResponse.json({ error: "Could not reach Paystack. Try again." }, { status: 502 });
  }
}