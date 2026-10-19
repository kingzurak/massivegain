/**
 * Shared real-data queries for the admin Overview and Statistics pages.
 * Server-side only (uses the server Supabase client, RLS-scoped to an
 * admin via the policies added in Milestone 6 Step 1).
 */
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus, Service } from "@/lib/supabase/types";

export interface AdminStats {
  totalUsers: number;
  totalServices: number;
  activeServices: number;
  totalOrders: number;
  /** Order value excluding cancelled (refunded) orders. */
  totalRevenue: number;
  ordersByStatus: Record<OrderStatus, number>;
}

const EMPTY_STATUS_COUNTS: Record<OrderStatus, number> = {
  pending: 0,
  processing: 0,
  completed: 0,
  cancelled: 0,
};

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createClient();

  const [usersCount, servicesRows, ordersRows] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("services").select("active").returns<Pick<Service, "active">[]>(),
    supabase.from("orders").select("amount, status").returns<Pick<Order, "amount" | "status">[]>(),
  ]);

  const services = servicesRows.data ?? [];
  const orders = ordersRows.data ?? [];

  const ordersByStatus = { ...EMPTY_STATUS_COUNTS };
  let totalRevenue = 0;
  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
    // Cancelled orders are refunded in full, so they never contributed
    // revenue. Matches how the customer dashboard defines "total spent" —
    // the two figures must not use different definitions of the same money.
    if (order.status !== "cancelled") {
      totalRevenue += Number(order.amount);
    }
  }

  return {
    totalUsers: usersCount.count ?? 0,
    totalServices: services.length,
    activeServices: services.filter((s) => s.active).length,
    totalOrders: orders.length,
    totalRevenue,
    ordersByStatus,
  };
}
