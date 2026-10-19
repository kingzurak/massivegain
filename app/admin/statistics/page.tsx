import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { getAdminStats } from "@/lib/admin/stats";
import { formatNaira } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminStatisticsPage() {
  const stats = await getAdminStats();

  return (
    <>
      <PageHeader title="Statistics" description="Platform figures, updated live from the database." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium text-ink-soft">Total users</p>
          <p className="mt-2 font-display text-xl text-navy-900">{stats.totalUsers}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Active services</p>
          <p className="mt-2 font-display text-xl text-navy-900">
            {stats.activeServices} / {stats.totalServices}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Total orders</p>
          <p className="mt-2 font-display text-xl text-navy-900">{stats.totalOrders}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Total revenue</p>
          <p className="mt-2 font-display text-xl text-navy-900">{formatNaira(stats.totalRevenue)}</p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg text-ink">Orders by status</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stats.ordersByStatus).map(([status, count]) => (
            <Card key={status}>
              <p className="text-xs font-medium capitalize text-ink-soft">{status}</p>
              <p className="mt-2 font-display text-xl text-navy-900">{count}</p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
