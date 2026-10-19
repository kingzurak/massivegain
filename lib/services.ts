import { createClient } from "@/lib/supabase/server";
import type { ServiceWithCategory } from "@/lib/supabase/types";

/**
 * Data shared by the public catalogue (/services) and the dashboard
 * catalogue (/dashboard/services), so the two can't drift apart.
 *
 * RLS allows anonymous reads of active services and categories, so this is
 * safe to call with no signed-in user.
 */
export async function getServicesPageData(): Promise<{
  services: ServiceWithCategory[];
  isLoggedIn: boolean;
  walletBalance: number | null;
}> {
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

  return { services: services ?? [], isLoggedIn: !!user, walletBalance };
}
