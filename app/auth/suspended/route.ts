import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * A suspended user is routed here from the dashboard/admin layouts.
 * Signs them out server-side (Server Components can't write cookies) and
 * sends them to the public notice page.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/suspended", request.url));
}
