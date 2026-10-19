import type {
  FulfilmentProvider,
  ProviderActionResult,
  ProviderOrderInput,
  ProviderOrderResult,
  ProviderStatusResult,
} from "./types";

/**
 * The only provider wired up today — there is no external API integrated
 * yet. Every order placed submits to this provider, which does nothing
 * but say "handle this by hand." The admin then fills in External Order
 * ID / Start Count / Link / Notes themselves in /admin/orders.
 *
 * This file exists to prove out the shape every future provider must
 * implement. Swapping in a real one later means creating a file like
 * `lib/providers/somesmm.ts` that implements FulfilmentProvider, and
 * adding one line to the registry in `index.ts` — no schema changes,
 * no changes to the order-placement route, no admin UI changes.
 */
export const manualProvider: FulfilmentProvider = {
  name: "manual",

  async createOrder(_input: ProviderOrderInput): Promise<ProviderOrderResult> {
    return {
      externalOrderId: null,
      startCount: null,
      status: "manual_pending",
      message: "No external provider configured — fulfil this order by hand in /admin/orders.",
    };
  },

  async getOrderStatus(_externalOrderId: string): Promise<ProviderStatusResult> {
    return { status: "unknown" };
  },

  async cancelOrder(_externalOrderId: string): Promise<ProviderActionResult> {
    return { success: true, message: "Nothing to cancel externally — fulfilment is manual." };
  },

  async refillOrder(_externalOrderId: string): Promise<ProviderActionResult> {
    return { success: false, message: "Refill isn't available for manually fulfilled orders." };
  },
};
