import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { getAdminStats } from "@/lib/admin/stats";
import { formatNaira } from "@/lib/utils";
import type { OrderWithService } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createClient();

  const [stats, { data: latestOrders }] = await Promise.all([
    getAdminStats(),
    supabase
      .from("orders")
      .select("*, service:services(name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<OrderWithService[]>(),
  ]);

  const cards = [
    { label: "Total users", value: stats.totalUsers.toLocaleString() },
    { label: "Active services", value: `${stats.activeServices} / ${stats.totalServices}` },
    { label: "Total orders", value: stats.totalOrders.toLocaleString() },
    { label: "Total revenue", value: formatNaira(stats.totalRevenue) },
  ];

  return (
    <>
      <PageHeader title="Admin overview" description="A snapshot of MassiveGain.ng right now." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Card key={stat.label}>
            <p className="text-xs font-medium text-ink-soft">{stat.label}</p>
            <p className="mt-2 font-display text-xl text-navy-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg text-ink">Latest orders</h2>
        {!latestOrders || latestOrders.length === 0 ? (
          <EmptyState title="No orders yet" description="New orders will appear here as customers place them." />
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
              {latestOrders.map((order) => (
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
