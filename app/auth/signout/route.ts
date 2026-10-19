import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();

  // 303 so the browser follows this redirect with a GET, not a repeated POST.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
