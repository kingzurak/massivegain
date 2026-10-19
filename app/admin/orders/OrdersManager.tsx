"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/client";
import { cn, formatNaira } from "@/lib/utils";
import FulfilmentModal from "./FulfilmentModal";
import type { CancelOrderResult, OrderStatus, OrderWithService } from "@/lib/supabase/types";

const STATUSES: OrderStatus[] = ["pending", "processing", "completed", "cancelled"];

const selectClass =
  "rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/20";

const CANCEL_OUTCOME_MESSAGES: Partial<Record<CancelOrderResult["outcome"], string>> = {
  invalid_status: "Completed orders can't be cancelled.",
  not_authorized: "You don't have permission to do that.",
  not_found: "That order couldn't be found.",
};

export interface AdminOrderRow extends OrderWithService {
  buyerName: string | null;
  buyerEmail: string;
}

export default function OrdersManager({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fulfillingOrder, setFulfillingOrder] = useState<AdminOrderRow | null>(null);

  async function handleStatusChange(order: AdminOrderRow, status: OrderStatus) {
    setError(null);
    setNotice(null);
    setBusyId(order.id);
    const supabase = createClient();

    if (status === "cancelled") {
      // Cancelling must refund the wallet — never a plain status update.
      const { data, error: rpcError } = await supabase
        .rpc("cancel_order_with_refund", { p_order_id: order.id })
        .single<CancelOrderResult>();
      setBusyId(null);

      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      if (!data || (data.outcome !== "cancelled" && data.outcome !== "already_cancelled")) {
        setError((data && CANCEL_OUTCOME_MESSAGES[data.outcome]) ?? "Couldn't cancel that order.");
        return;
      }
      setNotice(
        data.outcome === "cancelled"
          ? `Order ${order.order_number} cancelled and ${formatNaira(data.refund_amount ?? 0)} refunded to the customer's wallet.`
          : `Order ${order.order_number} was already cancelled and refunded.`
      );
      router.refresh();
      return;
    }

    const { error: updateError } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusyId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  if (orders.length === 0) {
    return <EmptyState title="No orders yet" description="Orders placed by customers will appear here." />;
  }

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <Table>
        <THead>
          <TRow>
            <TH>Order</TH>
            <TH>Customer</TH>
            <TH>Service</TH>
            <TH>Quantity</TH>
            <TH>Amount</TH>
            <TH>Date</TH>
            <TH>Status</TH>
            <TH>Fulfilment</TH>
          </TRow>
        </THead>
        <tbody>
          {orders.map((order) => (
            <TRow key={order.id}>
              <TD className="font-medium">{order.order_number}</TD>
              <TD>
                <div>{order.buyerName || "—"}</div>
                <div className="text-xs text-ink-soft">{order.buyerEmail}</div>
              </TD>
              <TD>{order.service?.name ?? "—"}</TD>
              <TD>{order.quantity.toLocaleString()}</TD>
              <TD>{formatNaira(order.amount)}</TD>
              <TD>{order.created_at.slice(0, 10)}</TD>
              <TD>
                <div className="flex items-center gap-2">
                  <Badge status={order.status} />
                  <select
                    className={cn(selectClass, busyId === order.id && "opacity-50")}
                    value={order.status}
                    disabled={busyId === order.id}
                    onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </TD>
              <TD>
                <Button size="sm" variant="outline" onClick={() => setFulfillingOrder(order)}>
                  {order.external_order_id ? "Edit" : "Fulfil"}
                </Button>
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>

      {fulfillingOrder && (
        <FulfilmentModal order={fulfillingOrder} onClose={() => setFulfillingOrder(null)} />
      )}
    </>
  );
}
