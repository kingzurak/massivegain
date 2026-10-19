import PageHeader from "@/components/ui/PageHeader";
import OrdersManager, { type AdminOrderRow } from "./OrdersManager";
import { createClient } from "@/lib/supabase/server";
import type { OrderWithService, Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = createClient();

  const [{ data: orders }, { data: profiles }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, service:services(name)")
      .order("created_at", { ascending: false })
      .returns<OrderWithService[]>(),
    supabase.from("profiles").select("id, full_name, email").returns<Pick<Profile, "id" | "full_name" | "email">[]>(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: AdminOrderRow[] = (orders ?? []).map((order) => {
    const buyer = profileById.get(order.user_id);
    return { ...order, buyerName: buyer?.full_name ?? null, buyerEmail: buyer?.email ?? "—" };
  });

  return (
    <>
      <PageHeader title="Orders" description="Every order placed across the platform." />
      <OrdersManager orders={rows} />
    </>
  );
}
