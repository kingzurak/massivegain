import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

const MAX_MARKUP_PERCENT = 1000;

/**
 * PATCH /api/admin/providers — save the import markup.
 * Body: { markupPercent: number }
 *
 * Upsert rather than update so the row is created even on a database where
 * the seed from the bestclout migration hasn't run.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const value = Number(body.markupPercent);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MARKUP_PERCENT) {
    return badRequest(`Enter a markup between 0 and ${MAX_MARKUP_PERCENT}.`);
  }

  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: "bestclout_markup_percent", value: String(value) }, { onConflict: "key" });

  if (error) return writeFailed("provider markup update", error.message);

  return NextResponse.json({ ok: true, markup: value });
}
