import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileStatus } from "@/lib/supabase/types";

export type ActiveSession =
  | { ok: true; user: User; status: ProfileStatus }
  | { ok: false; reason: "unauthenticated" | "inactive" };

/**
 * The single server-side gate for "is this request from a signed-in,
 * active account?". Route handlers that move money or write data must use
 * this instead of trusting a client-supplied id.
 *
 * Page navigations are covered separately by middleware.ts (status check)
 * and by the dashboard/admin layouts (which also need the profile row for
 * display). This helper exists so route handlers — which no page layout
 * guards — can't drift from that same rule.
 */
export async function getActiveSession(): Promise<ActiveSession> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", user.id)
    .single<Pick<Profile, "id" | "status">>();

  // profiles.status is constrained to ('active', 'suspended'); treat a
  // missing row the same as inactive rather than letting it through.
  if (!profile || profile.status !== "active") {
    return { ok: false, reason: "inactive" };
  }

  return { ok: true, user, status: profile.status };
}
