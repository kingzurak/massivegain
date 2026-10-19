import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveSession } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import { orderPlacementLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { PlaceOrderResult, Service } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Places an order and, on success, hands it to the fulfilment provider
 * layer. This is also the ONLY way an order can be placed at all —
 * place_order() in the database now has EXECUTE revoked from anon and
 * authenticated, granted only to service_role, so calling it straight
 * from the browser is no longer possible. That's what makes the rate
 * limit below actually binding rather than an easily-bypassed speed bump.
 *
 * Identity still comes from the user's own session (never trust a
 * client-supplied id) — it's just verified here, with the regular
 * session-bound client, and then passed explicitly to the service-role
 * client that does the actual writes.
 */
export async function POST(request: NextRequest) {
  // Logged in and not suspended — verified server-side, from the session
  // cookie, never from the request body.
  const session = await getActiveSession();
  if (!session.ok) {
    return NextResponse.json(
      {
        error:
          session.reason === "unauthenticated"
            ? "Log in to place an order."
            : "This account can't place orders.",
      },
      { status: session.reason === "unauthenticated" ? 401 : 403 }
    );
  }
  const user = session.user;

  const { success, reset } = await orderPlacementLimiter.limit(user.id);
  if (!success) {
    return rateLimitResponse(reset);
  }

  const body = await request.json().catch(() => null);
  const serviceId = body?.serviceId;
  const quantity = Number(body?.quantity);
  const reference = body?.reference;
  const link = typeof body?.link === "string" ? body.link.trim() : "";

  if (typeof serviceId !== "string" || !Number.isInteger(quantity) || typeof reference !== "string") {
    return NextResponse.json({ error: "Invalid order request." }, { status: 400 });
  }
  // Also validated inside place_order() itself — this just avoids a round
  // trip for the obvious case and gives a clearer message.
  if (!/^https?:\/\//i.test(link)) {
    return NextResponse.json({ error: "Enter a valid link starting with http:// or https://." }, { status: 400 });
  }
  if (link.length > 2048) {
    return NextResponse.json({ error: "That link is too long." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("place_order", {
      p_user_id: user.id,
      p_service_id: serviceId,
      p_quantity: quantity,
      p_reference: reference,
      p_link: link,
    })
    .single<PlaceOrderResult>();

  if (error) {
    console.error("[orders] place_order failed", error.message);
    return NextResponse.json({ error: "Couldn't place that order. Try again." }, { status: 500 });
  }

  if (!data || (data.outcome !== "success" && data.outcome !== "already_processed")) {
    const messages: Partial<Record<PlaceOrderResult["outcome"], string>> = {
      insufficient_balance: "Your wallet balance isn't enough for this order.",
      invalid_quantity: "Enter a quantity within the service's min/max range.",
      service_unavailable: "This service is no longer available.",
      invalid_reference: "Something went wrong preparing that order. Try again.",
      invalid_link: "Enter a valid link starting with http:// or https://.",
      not_authenticated: "Your session expired — log in again to order.",
    };
    return NextResponse.json(
      { error: (data && messages[data.outcome]) ?? "Couldn't place that order. Try again." },
      { status: 400 }
    );
  }

  // Order is created and paid for. Hand it to the fulfilment provider.
  // A failure here never undoes the order — it just stays "pending" for
  // an admin to pick up by hand, same as the manual provider already does.
  //
  // Uses the admin client, not the user's session: customers have no
  // UPDATE grant on orders at all (only admins do), so this write would
  // have silently done nothing under the old user-session client — a
  // latent bug this refactor surfaces and fixes, not just a style choice.
  if (data.outcome === "success" && data.order_id) {
    try {
      const { data: service } = await admin
        .from("services")
        .select("provider, provider_service_id, provider_service_type, provider_rate")
        .eq("id", serviceId)
        .single<Pick<Service, "provider" | "provider_service_id" | "provider_service_type" | "provider_rate">>();

      const provider = getProvider(service?.provider ?? "manual");
      const result = await provider.createOrder({
        orderId: data.order_id,
        orderNumber: data.order_number ?? "",
        link,
        quantity,
        providerServiceId: service?.provider_service_id ?? null,
        serviceType: service?.provider_service_type ?? null,
      });

      if (result.status === "submitted" && result.externalOrderId) {
        // Snapshot what the provider charges (NGN) so margin is auditable
        // even after the service's rate changes.
        const providerCost =
          service?.provider_rate != null
            ? Math.round((service.provider_rate * quantity) / 10) / 100
            : null;

        await admin
          .from("orders")
          .update({
            external_order_id: result.externalOrderId,
            start_count: result.startCount,
            provider_cost: providerCost,
            status: "processing",
          })
          .eq("id", data.order_id);
      }
    } catch (err) {
      console.error("[orders] provider dispatch failed", err);
      // Non-fatal — the order itself already succeeded above.
    }
  }

  return NextResponse.json({
    orderNumber: data.order_number,
    amount: data.amount,
    balance: data.balance,
  });
}