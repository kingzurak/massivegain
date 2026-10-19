/**
 * The fulfilment provider contract. Every provider — the built-in manual
 * one today, a real SMM API later — implements this same shape, so the
 * rest of the app (the order-placement route, the admin UI) never needs
 * to know which provider is actually handling a given order.
 */

export interface ProviderOrderInput {
  orderId: string;
  orderNumber: string;
  link: string | null;
  quantity: number;
  /** The upstream provider's service id. Null for services with no mapping. */
  providerServiceId: string | null;
  /**
   * The upstream service type (e.g. "Default", "Custom Comments"). Only
   * "Default" is ever auto-fulfilled; the rest are handled by hand.
   */
  serviceType: string | null;
}

export interface ProviderOrderResult {
  /** The provider's own order id, if it accepted the order immediately. */
  externalOrderId: string | null;
  startCount: number | null;
  status: "submitted" | "manual_pending" | "failed";
  message?: string;
}

export interface ProviderStatusResult {
  status: "pending" | "processing" | "completed" | "cancelled" | "unknown";
  startCount?: number | null;
  remains?: number | null;
  /** The provider's raw status text, kept verbatim for the admin UI. */
  rawStatus?: string | null;
}

export interface ProviderActionResult {
  success: boolean;
  message?: string;
}

export interface FulfilmentProvider {
  readonly name: string;
  createOrder(input: ProviderOrderInput): Promise<ProviderOrderResult>;
  getOrderStatus(externalOrderId: string): Promise<ProviderStatusResult>;
  cancelOrder(externalOrderId: string): Promise<ProviderActionResult>;
  refillOrder(externalOrderId: string): Promise<ProviderActionResult>;
}
