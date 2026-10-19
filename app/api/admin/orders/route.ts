import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";
import type { OrderStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";

/** Cancelling is deliberately NOT allowed here — see /api/admin/orders/cancel. */
const ALLOWED_STATUSES: OrderStatus[] = ["pending", "processing", "completed"];

/**
 * PATCH /api/admin/orders — change an order's status.
 *
 * Body: { orderId: string, status: "pending" | "processing" | "completed" }
 *
 * The database trigger guard_order_integrity is the final authority on
 * which transitions are legal (e.g. a completed order is terminal); this
 * handler just refuses to accept 'cancelled' so the refund path can't be
 * skipped.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const status = body.status as OrderStatus;

  if (!orderId) return badRequest("Missing order id.");
  if (!ALLOWED_STATUSES.includes(status)) {
    return badRequest("Cancelling an order must go through the cancel action.");
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id");

  if (error) return writeFailed("order status update", error.message);
  if (!data || data.length === 0) return badRequest("That order couldn't be found.");

  return NextResponse.json({ ok: true });
}
