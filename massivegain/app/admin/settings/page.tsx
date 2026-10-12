import PageHeader from "@/components/ui/PageHeader";
import SettingsManager from "./SettingsManager";
import { createClient } from "@/lib/supabase/server";
import type { SystemSetting } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = createClient();
  const { data: setting } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", "referral_commission_rate")
    .maybeSingle<SystemSetting>();

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration." />
      <SettingsManager initialRate={setting?.value ?? "5.0"} />
    </>
  );
}
