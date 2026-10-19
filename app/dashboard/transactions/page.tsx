import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import TransactionStatusBadge from "@/components/ui/TransactionStatusBadge";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, cn } from "@/lib/utils";
import type { Transaction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = createClient();

  // RLS limits this to the signed-in user's own transactions.
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Transaction[]>();

  return (
    <>
      <PageHeader title="Transactions" description="Every wallet credit and debit on your account." />

      {!transactions || transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Your wallet funding and order payments will show up here."
        />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Reference</TH>
              <TH>Type</TH>
              <TH>Description</TH>
              <TH>Date</TH>
              <TH>Status</TH>
              <TH>Amount</TH>
            </TRow>
          </THead>
          <tbody>
            {transactions.map((tx) => (
              <TRow key={tx.id}>
                <TD className="font-mono text-xs">{tx.reference}</TD>
                <TD className="capitalize">{tx.type}</TD>
                <TD>{tx.description}</TD>
                <TD>{tx.created_at.slice(0, 10)}</TD>
                <TD>
                  <TransactionStatusBadge status={tx.status} />
                </TD>
                <TD
                  className={cn(
                    "font-medium",
                    tx.status !== "success" ? "text-ink-soft" : tx.amount >= 0 ? "text-emerald-700" : "text-brick-700"
                  )}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatNaira(tx.amount)}
                </TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
