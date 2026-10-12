import { NextRequest, NextResponse } from "next/server";
import { settleFundingReference } from "@/lib/paystack";
import { paystackCallbackLimiter, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Paystack sends the customer's browser here after payment
 * (?reference=...). We verify with Paystack ourselves and credit the
 * wallet if it really succeeded, then send the user back to the wallet.
 *
 * Rate limited by IP rather than session: this route runs before we know
 * who's calling (no auth check — the reference itself is the real
 * security boundary, verified against Paystack directly), so there's no
 * user id to key on yet.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reference = params.get("reference") || params.get("trxref");

  const back = (status: string) =>
    NextResponse.redirect(new URL(`/dashboard/wallet?funding=${status}`, request.url), { status: 303 });

  const { success } = await paystackCallbackLimiter.limit(clientIp(request));
  if (!success) return back("error");

  if (!reference) return back("error");

  try {
    const outcome = await settleFundingReference(reference);
    return back(outcome === "ignored" ? "error" : outcome);
  } catch (err) {
    console.error("[paystack] callback failed", err);
    return back("error");
  }
}
