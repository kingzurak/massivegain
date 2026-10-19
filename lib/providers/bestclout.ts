import type {
  FulfilmentProvider,
  ProviderActionResult,
  ProviderOrderInput,
  ProviderOrderResult,
  ProviderStatusResult,
} from "./types";

/**
 * bestclout.com — a standard "Perfect Panel" v2 SMM reseller API.
 *
 * SERVER ONLY. The API key comes from BESTCLOUT_API_KEY (no NEXT_PUBLIC_
 * prefix), and every call is a form-encoded POST to one endpoint; the action
 * is chosen by the `action` field. There are no webhooks, so order status is
 * discovered by polling (`getOrderStatus` / `getOrderStatuses`).
 *
 * bestclout's own account currency is NGN, so every `rate`/`charge` returned
 * here is NGN per 1,000 — never USD. Nothing in this file does FX.
 */

const API_URL = "https://bestclout.com/api/v2";

/** A service as advertised by the provider's catalogue. `rate` is NGN/1,000. */
export interface CatalogueService {
  service: string;
  name: string;
  type: string;
  rate: number;
  min: number;
  max: number;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
  category: string;
}

function apiKey(): string {
  const key = process.env.BESTCLOUT_API_KEY;
  if (!key) throw new Error("BESTCLOUT_API_KEY is not set.");
  return key;
}

/** The v2 API reports failure as `{ "error": "..." }` — never as an HTTP code. */
function assertNotError(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
    const message = (data as { error: unknown }).error;
    throw new Error(typeof message === "string" && message ? message : "bestclout returned an error.");
  }
}

async function call(params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ key: apiKey(), ...params });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`bestclout returned a non-JSON response (HTTP ${res.status}).`);
  }

  assertNotError(data);
  return data;
}

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function mapProviderStatus(raw: unknown): ProviderStatusResult["status"] {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "completed" || s === "partial") return "completed";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  if (s === "pending" || s === "processing" || s === "in progress" || s === "in_progress") {
    return "processing";
  }
  return "unknown";
}

/** Fetches the full catalogue. A large response (hundreds of services). */
export async function getCatalogue(): Promise<CatalogueService[]> {
  const data = await call({ action: "services" });
  if (!Array.isArray(data)) {
    throw new Error("bestclout: unexpected catalogue response.");
  }

  return data.map((raw) => {
    const s = raw as Record<string, unknown>;
    return {
      service: String(s.service),
      name: String(s.name ?? ""),
      type: String(s.type ?? "Default"),
      rate: Number(s.rate),
      min: toInt(s.min) ?? 1,
      max: toInt(s.max) ?? 1,
      dripfeed: s.dripfeed === true,
      refill: s.refill === true,
      cancel: s.cancel === true,
      category: String(s.category ?? ""),
    };
  });
}

export async function getBalance(): Promise<{ balance: number; currency: string }> {
  const data = (await call({ action: "balance" })) as { balance?: unknown; currency?: unknown };
  return {
    balance: Number(data.balance ?? 0),
    currency: String(data.currency ?? "NGN"),
  };
}

/** Status for many orders at once (the API accepts a comma list, up to 100). */
export async function getOrderStatuses(
  externalOrderIds: string[]
): Promise<Record<string, ProviderStatusResult>> {
  if (externalOrderIds.length === 0) return {};

  const data = await call({ action: "status", orders: externalOrderIds.join(",") });
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};

  const out: Record<string, ProviderStatusResult> = {};
  for (const [id, raw] of Object.entries(data as Record<string, unknown>)) {
    const d = (raw ?? {}) as Record<string, unknown>;
    out[id] = {
      status: mapProviderStatus(d.status),
      startCount: toInt(d.start_count),
      remains: toInt(d.remains),
      rawStatus: typeof d.status === "string" ? d.status : null,
    };
  }
  return out;
}

/**
 * bestclout's `add` endpoint takes one order at a time and returns the new
 * provider order id. Only Default-type services are sent here — anything
 * else (Custom Comments, Comment Likes/Replies, Package) needs customer
 * input we don't collect, so it stays with the manual provider.
 */
export const bestcloutProvider: FulfilmentProvider = {
  name: "bestclout",

  async createOrder(input: ProviderOrderInput): Promise<ProviderOrderResult> {
    if (!input.providerServiceId) {
      return {
        externalOrderId: null,
        startCount: null,
        status: "failed",
        message: "This service isn't linked to a bestclout service.",
      };
    }
    if (input.serviceType && input.serviceType !== "Default") {
      return {
        externalOrderId: null,
        startCount: null,
        status: "failed",
        message: `bestclout "${input.serviceType}" services are fulfilled manually.`,
      };
    }
    if (!input.link) {
      return {
        externalOrderId: null,
        startCount: null,
        status: "failed",
        message: "Order has no link to fulfil.",
      };
    }

    const data = (await call({
      action: "add",
      service: input.providerServiceId,
      link: input.link,
      quantity: String(input.quantity),
    })) as { order?: unknown };

    const orderId = data.order;
    if (orderId === undefined || orderId === null) {
      return {
        externalOrderId: null,
        startCount: null,
        status: "failed",
        message: "bestclout didn't return an order id.",
      };
    }

    return { externalOrderId: String(orderId), startCount: null, status: "submitted" };
  },

  async getOrderStatus(externalOrderId: string): Promise<ProviderStatusResult> {
    const map = await getOrderStatuses([externalOrderId]);
    return map[externalOrderId] ?? { status: "unknown" };
  },

  async cancelOrder(externalOrderId: string): Promise<ProviderActionResult> {
    const data = await call({ action: "cancel", orders: externalOrderId });
    const entry = (Array.isArray(data) ? data[0] : data) as
      | { cancel?: { status?: unknown } }
      | undefined;
    const status = entry?.cancel?.status;
    return {
      success: status === "Success",
      message: typeof status === "string" ? status : "No cancel result returned.",
    };
  },

  async refillOrder(): Promise<ProviderActionResult> {
    // No service in the current catalogue supports refill.
    return { success: false, message: "Refill isn't supported by bestclout." };
  },
};
