import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProviderOrders } from "@/lib/providers/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polls the fulfilment provider for the status of every open order. There is
 * no user session here — this is meant to be called by Vercel Cron, which
 * sends `Authorization: Bearer $CRON_SECRET` automatically once CRON_SECRET
 * is set in the project's environment.
 *
 * Fails closed: without CRON_SECRET configured it refuses to run at all, so
 * this can never be left open in a deployment that forgot to set the secret.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await syncProviderOrders(createAdminClient());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron] sync-orders failed", err);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
