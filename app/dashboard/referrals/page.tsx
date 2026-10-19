import { headers } from "next/headers";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import CopyLinkButton from "./CopyLinkButton";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/utils";
import type { Profile, SystemSetting, Transaction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { count: referredCount }, { data: commissionTx }, { data: rateSetting }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user?.id ?? "")
        .single<Pick<Profile, "referral_code">>(),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", user?.id ?? ""),
      supabase
        .from("transactions")
        .select("*")
        .eq("type", "commission")
        .order("created_at", { ascending: false })
        .returns<Transaction[]>(),
      supabase
        .from("system_settings")
        .select("*")
        .eq("key", "referral_commission_rate")
        .maybeSingle<SystemSetting>(),
    ]);

  // Falls back to the actual request's own host rather than a guessed
  // domain — if NEXT_PUBLIC_SITE_URL is ever missing in an environment,
  // this still produces a correct, working link instead of a dead one.
  const headersList = headers();
  const fallbackOrigin = `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host") ?? "localhost:3000"}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin;
  const referralLink = profile ? `${siteUrl}/register?ref=${profile.referral_code}` : "";
  const totalEarned = (commissionTx ?? [])
    .filter((tx) => tx.status === "success")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const rate = rateSetting ? Number(rateSetting.value) : 5;

  return (
    <>
      <PageHeader
        title="Referrals"
        description={`Invite people to MassiveGain.ng and earn ${rate}% on every order they place — for as long as they keep ordering.`}
      />

      <Card>
        <p className="text-xs font-medium text-ink-soft">Your referral link</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={referralLink}
            className="flex-1 truncate rounded-md border border-surface-border bg-surface-muted px-3.5 py-2.5 text-sm text-ink"
            onFocus={(e) => e.target.select()}
          />
          <CopyLinkButton link={referralLink} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Code: <span className="font-mono">{profile?.referral_code}</span>
        </p>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium text-ink-soft">People you&apos;ve referred</p>
          <p className="mt-2 font-display text-xl text-navy-900">{referredCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-ink-soft">Total commissions earned</p>
          <p className="mt-2 font-display text-xl text-navy-900">{formatNaira(totalEarned)}</p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg text-ink">Commission history</h2>
        {!commissionTx || commissionTx.length === 0 ? (
          <EmptyState
            title="No commissions yet"
            description="Once someone you referred places an order, your commission shows up here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border rounded-lg border border-surface-border bg-surface">
            {commissionTx.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-ink">{tx.description}</p>
                  <p className="text-xs text-ink-soft">{tx.created_at.slice(0, 10)}</p>
                </div>
                <span className={tx.amount >= 0 ? "font-medium text-emerald-700" : "font-medium text-brick-700"}>
                  {tx.amount >= 0 ? "+" : ""}
                  {formatNaira(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
