import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";
import type { ProfileStatus } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ALLOWED_STATUSES: ProfileStatus[] = ["active", "suspended"];

/**
 * PATCH /api/admin/users — suspend or reactivate an account.
 *
 * Body: { userId: string, status: "active" | "suspended" }
 *
 * Changing your own status is rejected outright rather than being silently
 * reverted by the database trigger — a clear error beats a no-op.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { session } = guard;
  const { supabase } = session;

  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const status = body.status as ProfileStatus;

  if (!userId) return badRequest("Missing user id.");
  if (!ALLOWED_STATUSES.includes(status)) return badRequest("Unknown status.");
  if (userId === session.user.id) return badRequest("You can't change your own status.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId)
    .select("id");

  if (error) return writeFailed("user status update", error.message);
  if (!data || data.length === 0) return badRequest("That user couldn't be found.");

  return NextResponse.json({ ok: true });
}
