import PageHeader from "@/components/ui/PageHeader";
import FinancialLogs, { type AdminTransactionRow } from "./FinancialLogs";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Transaction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  const supabase = createClient();

  const [{ data: transactions }, { data: profiles }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Transaction[]>(),
    supabase.from("profiles").select("id, full_name, email").returns<Pick<Profile, "id" | "full_name" | "email">[]>(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows: AdminTransactionRow[] = (transactions ?? []).map((tx) => {
    const buyer = profileById.get(tx.user_id);
    return { ...tx, buyerName: buyer?.full_name ?? null, buyerEmail: buyer?.email ?? "—" };
  });

  return (
    <>
      <PageHeader title="Transactions" description="Wallet activity across every account." />
      <FinancialLogs transactions={rows} />
    </>
  );
}
