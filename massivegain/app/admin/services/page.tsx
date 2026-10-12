import PageHeader from "@/components/ui/PageHeader";
import ServicesManager from "./ServicesManager";
import { createClient } from "@/lib/supabase/server";
import type { Category, ServiceWithCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const supabase = createClient();

  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase
      .from("services")
      .select("*, category:categories(name)")
      .order("created_at", { ascending: false })
      .returns<ServiceWithCategory[]>(),
    supabase.from("categories").select("*").order("name").returns<Category[]>(),
  ]);

  return (
    <>
      <PageHeader
        title="Services"
        description="Create, price and activate the marketing services customers can order."
      />
      <ServicesManager services={services ?? []} categories={categories ?? []} />
    </>
  );
}
