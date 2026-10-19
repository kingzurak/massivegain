import type { FulfilmentProvider } from "./types";
import { manualProvider } from "./manual";
import { bestcloutProvider } from "./bestclout";

const registry: Record<string, FulfilmentProvider> = {
  manual: manualProvider,
  bestclout: bestcloutProvider,
};

/**
 * Looks up a provider by name. A service's `provider` column (copied onto
 * each order at placement time) decides which one handles it. Unknown or
 * unconfigured names fall back to manual rather than failing the order.
 */
export function getProvider(name: string): FulfilmentProvider {
  return registry[name] ?? manualProvider;
}

export * from "./types";
