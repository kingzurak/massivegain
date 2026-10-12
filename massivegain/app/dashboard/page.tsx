import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/utils";
import type { OrderWithService, Wallet } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already scopes both queries to the signed-in user's own rows.
  const [{ data: wallet }, { data: orders }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user?.id ?? "").maybeSingle<Wallet>(),
    supabase
      .from("orders")
      .select("*, service:services(name)")
      .order("created_at", { ascending: false })
      .returns<OrderWithService[]>(),
  ]);

  const allOrders = orders ?? [];
  const activeOrders = allOrders.filter((o) => o.status === "pending" || o.status === "processing").length;
  const completedOrders = allOrders.filter((o) => o.status === "completed").length;
  // Cancelled orders are refunded (Milestone 7), so they no longer count as spent.
  const totalSpent = allOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const stats = [
    { label: "Wallet balance", value: formatNaira(wallet?.balance ?? 0) },
    { label: "Active orders", value: activeOrders.toLocaleString() },
    { label: "Completed orders", value: completedOrders.toLocaleString() },
    { label: "Total spent", value: formatNaira(totalSpent) },
  ];

  const recentOrders = allOrders.slice(0, 4);

  return (
    <>
      <PageHeader
        title="Overview"
        action={
          <Link href="/dashboard/wallet">
            <Button>Fund wallet</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs font-medium text-ink-soft">{stat.label}</p>
            <p className="mt-2 font-display text-xl text-navy-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Recent orders</h2>
          <Link href="/dashboard/orders" className="text-sm font-medium text-brick-600 hover:text-brick-700">
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState title="No orders yet" description="Orders you place will show up here." />
        ) : (
          <Table>
            <THead>
              <TRow>
                <TH>Order</TH>
                <TH>Service</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
              </TRow>
            </THead>
            <tbody>
              {recentOrders.map((order) => (
                <TRow key={order.id}>
                  <TD className="font-medium">{order.order_number}</TD>
                  <TD>{order.service?.name ?? "—"}</TD>
                  <TD>{formatNaira(order.amount)}</TD>
                  <TD>
                    <Badge status={order.status} />
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
