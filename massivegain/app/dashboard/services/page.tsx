import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ServicesBrowser from "./ServicesBrowser";
import { createClient } from "@/lib/supabase/server";
import type { ServiceWithCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = createClient();

  const [{ data: services }, { data: { user } }] = await Promise.all([
    supabase
      .from("services")
      .select("*, category:categories(name)")
      .eq("active", true)
      .order("name")
      .returns<ServiceWithCategory[]>(),
    supabase.auth.getUser(),
  ]);

  let walletBalance: number | null = null;
  if (user) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle<{ balance: number }>();
    walletBalance = wallet?.balance ?? 0;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Marketing services available to order, organised by platform."
      />

      {!services || services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Services will appear here once they're added from the admin panel."
        />
      ) : (
        <ServicesBrowser
          services={services}
          isLoggedIn={!!user}
          walletBalance={walletBalance}
        />
      )}
    </div>
  );
}