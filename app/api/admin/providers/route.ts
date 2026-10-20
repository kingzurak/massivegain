import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

const MAX_MARKUP_PERCENT = 1000;
const MAX_FLAT = 1_000_000;

/**
 * PATCH /api/admin/providers — save the global default charge.
 * Body: { markupPercent?: number, chargeFlat?: number }
 *
 * These are the fallbacks used for any service that doesn't set its own
 * charge override, and the starting point when importing. Either key may be
 * sent on its own. Upsert rather than update so the rows exist even on a
 * database where the seed migrations haven't run.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const rows: { key: string; value: string }[] = [];

  if (body.markupPercent !== undefined) {
    const value = Number(body.markupPercent);
    if (!Number.isFinite(value) || value < 0 || value > MAX_MARKUP_PERCENT) {
      return badRequest(`Enter a markup between 0 and ${MAX_MARKUP_PERCENT}.`);
    }
    rows.push({ key: "bestclout_markup_percent", value: String(value) });
  }

  if (body.chargeFlat !== undefined) {
    const value = Number(body.chargeFlat);
    if (!Number.isFinite(value) || value < 0 || value > MAX_FLAT) {
      return badRequest(`Enter a flat fee between 0 and ${MAX_FLAT.toLocaleString()}.`);
    }
    rows.push({ key: "default_charge_flat", value: String(value) });
  }

  if (rows.length === 0) return badRequest("Nothing to save.");

  const { error } = await supabase
    .from("system_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) return writeFailed("provider charge update", error.message);

  return NextResponse.json({ ok: true });
}
