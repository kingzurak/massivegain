import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/utils";
import type { OrderWithService } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = createClient();

  // RLS limits this to the signed-in user's own orders.
  const { data: orders } = await supabase
    .from("orders")
    .select("*, service:services(name)")
    .order("created_at", { ascending: false })
    .returns<OrderWithService[]>();

  return (
    <>
      <PageHeader title="Orders" description="Every order placed from your account." />

      {!orders || orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, you'll be able to track its status here."
        />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Order</TH>
              <TH>Service</TH>
              <TH>Quantity</TH>
              <TH>Amount</TH>
              <TH>Date</TH>
              <TH>Status</TH>
            </TRow>
          </THead>
          <tbody>
            {orders.map((order) => (
              <TRow key={order.id}>
                <TD className="font-medium">{order.order_number}</TD>
                <TD>{order.service?.name ?? "—"}</TD>
                <TD>{order.quantity.toLocaleString()}</TD>
                <TD>{formatNaira(order.amount)}</TD>
                <TD>{order.created_at.slice(0, 10)}</TD>
                <TD>
                  <Badge status={order.status} />
                </TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
