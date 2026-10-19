import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import type { AdminSession } from "@/lib/auth";

type AdminSuccess = Extract<AdminSession, { ok: true }>;

const REASON_MESSAGES: Record<"unauthenticated" | "inactive" | "forbidden", string> = {
  unauthenticated: "Log in as an admin to do that.",
  inactive: "This account is not active.",
  forbidden: "Admins only.",
};

/**
 * Guard for every /api/admin/* handler. Returns either the admin's own
 * session-bound client (so RLS still applies to the write) or a ready-made
 * error response to return as-is.
 *
 * Usage:
 *   const guard = await requireAdmin();
 *   if ("error" in guard) return guard.error;
 *   const { session } = guard;
 */
export async function requireAdmin(): Promise<{ session: AdminSuccess } | { error: NextResponse }> {
  const session = await getAdminSession();
  if (session.ok) return { session };

  return {
    error: NextResponse.json(
      { error: REASON_MESSAGES[session.reason] },
      { status: session.reason === "unauthenticated" ? 401 : 403 }
    ),
  };
}

/** Rejects malformed input before any database work happens. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Keeps Postgres error text out of the UI while still logging it server-side. */
export function writeFailed(scope: string, message: string): NextResponse {
  console.error(`[admin] ${scope} failed`, message);
  return NextResponse.json({ error: "Couldn't save that change. Try again." }, { status: 500 });
}

/** Reads a JSON body, tolerating a malformed/missing one. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
