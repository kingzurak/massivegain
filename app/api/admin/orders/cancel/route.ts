import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";
import type { CancelOrderResult } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/cancel — cancel an order and refund the wallet.
 *
 * Body: { orderId: string }
 *
 * Deliberately its own endpoint: cancellation must never be a plain status
 * update, or the customer gets no refund and the referrer's commission is
 * never reversed. The database function does the money movement and refuses
 * completed orders; the outcome is returned so the UI can word it precisely.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) return badRequest("Missing order id.");

  const { data, error } = await supabase
    .rpc("cancel_order_with_refund", { p_order_id: orderId })
    .single<CancelOrderResult>();

  if (error) return writeFailed("order cancel", error.message);

  return NextResponse.json({ ok: true, result: data });
}
