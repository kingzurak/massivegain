import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileStatus } from "@/lib/supabase/types";

export type ActiveSession =
  | { ok: true; user: User; status: ProfileStatus }
  | { ok: false; reason: "unauthenticated" | "inactive" };

export type AdminSession =
  | { ok: true; user: User; supabase: ReturnType<typeof createClient> }
  | { ok: false; reason: "unauthenticated" | "inactive" | "forbidden" };

type SessionRow = Pick<Profile, "id" | "status" | "role">;

/**
 * One round trip that answers "who is this, and are they allowed in?".
 * Both helpers below derive from it so the rule lives in exactly one place.
 */
async function loadSession() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, status, role")
    .eq("id", user.id)
    .single<SessionRow>();

  return { user, profile, supabase };
}

/**
 * The server-side gate for "is this request from a signed-in, active
 * account?". Route handlers that move money must use this instead of
 * trusting anything client-supplied.
 *
 * Page navigations are covered separately by middleware.ts (status check)
 * and the dashboard/admin layouts (which also need the profile for display).
 */
export async function getActiveSession(): Promise<ActiveSession> {
  const session = await loadSession();
  if (!session) return { ok: false, reason: "unauthenticated" };

  // profiles.status is constrained to ('active', 'suspended'); a missing row
  // is treated the same as inactive rather than being let through.
  if (!session.profile || session.profile.status !== "active") {
    return { ok: false, reason: "inactive" };
  }

  return { ok: true, user: session.user, status: session.profile.status };
}

/**
 * Admin-only variant for /api/admin/*. This is an app-layer authorization
 * check on top of RLS: the SQL policies call is_admin(), so a non-admin who
 * calls the underlying table would already be refused — but every admin
 * mutation is now routed through a server handler that says no explicitly,
 * rather than depending on the database being the only thing that says no.
 *
 * The returned client is the caller's own session-bound client, NOT the
 * service-role client, so RLS still applies to the write that follows.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const session = await loadSession();
  if (!session) return { ok: false, reason: "unauthenticated" };

  if (!session.profile || session.profile.status !== "active") {
    return { ok: false, reason: "inactive" };
  }

  if (session.profile.role !== "admin") {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, user: session.user, supabase: session.supabase };
}
