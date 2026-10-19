import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrderStatuses } from "./bestclout";
import type { ProviderStatusResult } from "./types";

/**
 * Pulls the current status of every open bestclout order and reflects it on
 * our side. Shared by the protected cron route (service-role client) and the
 * admin "Sync now" button (admin session client), so the two can never drift.
 *
 * bestclout has no webhooks, so polling is the only way to learn an order
 * finished. Cancellations can't be refunded from here — cancel_and_refund()
 * needs an admin session — so a provider-cancelled order is flagged with
 * `refund_required` for an admin to action.
 */

const BATCH_SIZE = 100;

export interface SyncSummary {
  checked: number;
  updated: number;
  completed: number;
  cancelled: number;
  errors: number;
}

interface OpenOrder {
  id: string;
  external_order_id: string | null;
}

export async function syncProviderOrders(supabase: SupabaseClient): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: 0, updated: 0, completed: 0, cancelled: 0, errors: 0 };

  const { data, error } = await supabase
    .from("orders")
    .select("id, external_order_id")
    .eq("provider", "bestclout")
    .not("external_order_id", "is", null)
    .in("status", ["pending", "processing"])
    .returns<OpenOrder[]>();

  if (error) throw new Error(error.message);

  const orders = (data ?? []).filter((o): o is OpenOrder & { external_order_id: string } =>
    Boolean(o.external_order_id)
  );
  summary.checked = orders.length;

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);

    let statuses: Record<string, ProviderStatusResult>;
    try {
      statuses = await getOrderStatuses(batch.map((o) => o.external_order_id));
    } catch (err) {
      console.error("[sync] status lookup failed", err);
      summary.errors += batch.length;
      continue;
    }

    for (const order of batch) {
      const result = statuses[order.external_order_id];
      if (!result || result.status === "unknown") continue;

      const update: Record<string, unknown> = {
        provider_status: result.rawStatus ?? null,
        provider_synced_at: new Date().toISOString(),
      };

      if (result.status === "completed") {
        update.status = "completed";
        summary.completed += 1;
      } else if (result.status === "cancelled") {
        update.refund_required = true;
        summary.cancelled += 1;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(update)
        .eq("id", order.id);

      if (updateError) {
        console.error("[sync] order update failed", order.id, updateError.message);
        summary.errors += 1;
        continue;
      }
      summary.updated += 1;
    }
  }

  return summary;
}
