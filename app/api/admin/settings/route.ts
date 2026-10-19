import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

/**
 * Only settings the admin UI actually manages are writable. An allowlist
 * (not a free-form key) means a compromised or buggy client can't point this
 * at an unrelated row in system_settings.
 */
const ALLOWED_KEYS = ["referral_commission_rate"] as const;

/**
 * PATCH /api/admin/settings — update one setting.
 * Body: { key: "referral_commission_rate", value: number }
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const key = typeof body.key === "string" ? body.key : "";
  if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
    return badRequest("Unknown setting.");
  }

  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return badRequest("Enter a percentage between 0 and 100.");
  }

  const { data, error } = await supabase
    .from("system_settings")
    .update({ value: String(value) })
    .eq("key", key)
    .select("key");

  if (error) return writeFailed("setting update", error.message);
  if (!data || data.length === 0) return badRequest("That setting doesn't exist.");

  return NextResponse.json({ ok: true });
}
