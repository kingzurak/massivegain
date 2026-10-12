import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import TransactionStatusBadge from "@/components/ui/TransactionStatusBadge";
import FundWalletForm from "./FundWalletForm";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, cn } from "@/lib/utils";
import type { Transaction, Wallet } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const notices: Record<string, { text: string; tone: "good" | "warn" | "bad" }> = {
  success: { text: "Payment confirmed — your wallet has been credited.", tone: "good" },
  pending: { text: "Your payment hasn't been confirmed yet. If you were charged, your balance will update shortly.", tone: "warn" },
  failed: { text: "That payment didn't go through. You have not been charged.", tone: "bad" },
  error: { text: "We couldn't confirm that payment. If you were charged, contact support with your reference.", tone: "bad" },
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: { funding?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already limits both queries to the signed-in user's own rows.
  const [{ data: wallet }, { data: recent }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user?.id ?? "").maybeSingle<Wallet>(),
    supabase
      .from("transactions")
      .select("*")
      .in("type", ["funding", "refund"])
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<Transaction[]>(),
  ]);

  const balance = wallet?.balance ?? 0;
  const notice = searchParams.funding ? notices[searchParams.funding] : undefined;

  return (
    <>
      <PageHeader title="Wallet" description="Fund your wallet and use it to pay for orders instantly." />

      {notice && (
        <div
          className={cn(
            "mb-6 rounded-md border px-3.5 py-2.5 text-sm",
            notice.tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            notice.tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
            notice.tone === "bad" && "border-red-200 bg-brick-100 text-brick-700"
          )}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <p className="text-xs font-medium text-ink-soft">Current balance</p>
          <p className="mt-2 font-display text-3xl text-navy-900">{formatNaira(balance)}</p>

          <div className="mt-6 border-t border-surface-border pt-5">
            <p className="text-sm font-medium text-ink">Fund wallet</p>
            <FundWalletForm />
            <p className="mt-3 text-xs text-ink-soft">
              Payments are processed by Paystack. MassiveGain.ng never sees or stores your card details.
            </p>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-ink">Recent wallet activity</p>
          {!recent || recent.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No activity yet" description="Fund your wallet to get started." />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-ink">{tx.description}</p>
                    <p className="text-xs text-ink-soft">{tx.created_at.slice(0, 10)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "font-medium",
                        tx.status !== "success" ? "text-ink-soft" : tx.amount >= 0 ? "text-emerald-700" : "text-brick-700"
                      )}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatNaira(tx.amount)}
                    </span>
                    {tx.status !== "success" && <TransactionStatusBadge status={tx.status} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
