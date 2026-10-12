/**
 * Paystack helpers. SERVER ONLY — reads PAYSTACK_SECRET_KEY.
 * Uses Paystack's REST API directly (no extra packages).
 */
import { createAdminClient } from "@/lib/supabase/admin";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

export interface PaystackInitResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
}): Promise<PaystackInitResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100), // Paystack uses kobo
      currency: "NGN",
      reference: params.reference,
      callback_url: params.callbackUrl,
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status || !json?.data?.authorization_url) {
    throw new Error(json?.message ?? "Paystack could not start the payment.");
  }
  return json.data as PaystackInitResult;
}

interface PaystackVerifyData {
  status: string; // "success" | "failed" | "abandoned" | ...
  amount: number; // kobo
  currency: string;
  reference: string;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyData | null> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });

  if (res.status === 404) return null; // reference unknown to Paystack
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status || !json?.data) {
    throw new Error(json?.message ?? "Could not verify the payment with Paystack.");
  }
  return json.data as PaystackVerifyData;
}

export type SettleOutcome = "success" | "failed" | "pending" | "ignored" | "error";

/**
 * Single code path used by BOTH the browser callback and the webhook.
 * Never trusts the caller: it asks Paystack directly for the payment's
 * real status and amount, then lets the database function credit the
 * wallet exactly once.
 */
export async function settleFundingReference(reference: string): Promise<SettleOutcome> {
  const verified = await verifyPaystackTransaction(reference);
  if (!verified) return "ignored";

  const admin = createAdminClient();

  if (verified.status === "success") {
    if (verified.currency !== "NGN") {
      console.error("[paystack] unexpected currency", reference, verified.currency);
      return "error";
    }

    const { data, error } = await admin.rpc("settle_funding_success", {
      p_reference: reference,
      p_paid_amount: verified.amount / 100,
    });

    if (error) {
      console.error("[paystack] settle failed", reference, error.message);
      throw new Error("Could not record the payment.");
    }

    if (data === "credited" || data === "already_processed") return "success";
    if (data === "not_found") return "ignored"; // not one of our payments
    console.error("[paystack] settle rejected", reference, data); // e.g. amount_mismatch
    return "error";
  }

  if (verified.status === "failed") {
    await admin.rpc("mark_funding_failed", { p_reference: reference });
    return "failed";
  }

  return "pending"; // abandoned / still in progress
}
