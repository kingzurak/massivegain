import PageHeader from "@/components/ui/PageHeader";
import UsersManager from "./UsersManager";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Wallet } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = createClient();

  const [
    {
      data: { user },
    },
    { data: profiles },
    { data: wallets },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
    supabase.from("wallets").select("user_id, balance").returns<Pick<Wallet, "user_id" | "balance">[]>(),
  ]);

  const balanceByUser = new Map((wallets ?? []).map((w) => [w.user_id, w.balance]));
  const users = (profiles ?? []).map((p) => ({
    ...p,
    walletBalance: balanceByUser.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHeader title="Users" description="Everyone with a MassiveGain.ng account." />
      <UsersManager users={users} currentUserId={user?.id ?? ""} />
    </>
  );
}
