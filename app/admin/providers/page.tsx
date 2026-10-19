import PageHeader from "@/components/ui/PageHeader";
import ProvidersManager from "./ProvidersManager";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/providers/bestclout";
import type { Service } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const supabase = createClient();

  const [{ data: services }, { data: setting }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("provider", "bestclout")
      .order("name")
      .returns<Service[]>(),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "bestclout_markup_percent")
      .maybeSingle<{ value: string }>(),
  ]);

  // Reaching bestclout is best-effort: an unset key or an outage should not
  // stop the admin from managing the mapping, so the error is shown inline.
  let balance: { balance: number; currency: string } | null = null;
  let balanceError: string | null = null;
  try {
    balance = await getBalance();
  } catch (err) {
    balanceError = err instanceof Error ? err.message : "Couldn't reach bestclout.";
  }

  return (
    <>
      <PageHeader
        title="Providers"
        description="Connect upstream fulfilment providers and map their services to yours."
      />
      <ProvidersManager
        balance={balance}
        balanceError={balanceError}
        markup={setting?.value ?? "30"}
        services={services ?? []}
      />
    </>
  );
}
