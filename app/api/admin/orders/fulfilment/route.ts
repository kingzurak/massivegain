import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

const MAX_LINK_LENGTH = 2048;
const MAX_NOTES_LENGTH = 2000;

/**
 * PATCH /api/admin/orders/fulfilment — record manual fulfilment details.
 *
 * Body: {
 *   orderId: string,
 *   externalOrderId?: string,
 *   startCount?: number,
 *   link?: string,
 *   adminNotes?: string,
 * }
 *
 * Status is not settable here; use PATCH /api/admin/orders for that.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) return badRequest("Missing order id.");

  const externalOrderId = typeof body.externalOrderId === "string" ? body.externalOrderId.trim() : "";
  const link = typeof body.link === "string" ? body.link.trim() : "";
  const adminNotes = typeof body.adminNotes === "string" ? body.adminNotes : "";

  let startCount: number | null = null;
  if (body.startCount !== undefined && body.startCount !== null && body.startCount !== "") {
    const parsed = Number(body.startCount);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return badRequest("Start count must be a whole number of 0 or more.");
    }
    startCount = parsed;
  }

  if (link && !/^https?:\/\//i.test(link)) {
    return badRequest("Enter a link starting with http:// or https://.");
  }
  if (link.length > MAX_LINK_LENGTH) return badRequest("That link is too long.");
  if (adminNotes.length > MAX_NOTES_LENGTH) return badRequest("Those notes are too long.");

  const { data, error } = await supabase
    .from("orders")
    .update({
      external_order_id: externalOrderId || null,
      start_count: startCount,
      link: link || null,
      admin_notes: adminNotes,
    })
    .eq("id", orderId)
    .select("id");

  if (error) return writeFailed("order fulfilment update", error.message);
  if (!data || data.length === 0) return badRequest("That order couldn't be found.");

  return NextResponse.json({ ok: true });
}
