"use client";

import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import TransactionStatusBadge from "@/components/ui/TransactionStatusBadge";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { cn, formatNaira } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/supabase/types";

export interface AdminTransactionRow extends Transaction {
  buyerName: string | null;
  buyerEmail: string;
}

const TYPE_FILTERS: Array<"All" | TransactionType> = ["All", "funding", "order", "refund", "commission"];

export default function FinancialLogs({ transactions }: { transactions: AdminTransactionRow[] }) {
  const [typeFilter, setTypeFilter] = useState<"All" | TransactionType>("All");

  const filtered =
    typeFilter === "All" ? transactions : transactions.filter((tx) => tx.type === typeFilter);

  if (transactions.length === 0) {
    return (
      <EmptyState title="No transactions yet" description="Wallet activity across all accounts will appear here." />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
              typeFilter === t
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-surface-border bg-surface text-ink-muted hover:border-navy-600"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching transactions" description="Try a different filter." />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Reference</TH>
              <TH>Customer</TH>
              <TH>Type</TH>
              <TH>Description</TH>
              <TH>Date</TH>
              <TH>Status</TH>
              <TH>Amount</TH>
            </TRow>
          </THead>
          <tbody>
            {filtered.map((tx) => (
              <TRow key={tx.id}>
                <TD className="font-mono text-xs">{tx.reference}</TD>
                <TD>
                  <div>{tx.buyerName || "—"}</div>
                  <div className="text-xs text-ink-soft">{tx.buyerEmail}</div>
                </TD>
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
