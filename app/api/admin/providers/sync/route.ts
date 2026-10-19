import { NextResponse } from "next/server";
import { requireAdmin, writeFailed } from "@/lib/admin/api";
import { syncProviderOrders } from "@/lib/providers/sync";

export const runtime = "nodejs";

/**
 * POST /api/admin/providers/sync — the admin "Sync now" button.
 *
 * Runs through the admin's own session-bound client rather than the
 * service-role client, so the RLS policy "Admins can update orders" is the
 * second line of defence here, exactly as it is for the other admin routes.
 */
export async function POST() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const summary = await syncProviderOrders(guard.session.supabase);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return writeFailed("provider sync", err instanceof Error ? err.message : String(err));
  }
}
