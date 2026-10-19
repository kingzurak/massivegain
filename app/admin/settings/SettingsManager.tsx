"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { createClient } from "@/lib/supabase/client";

export default function SettingsManager({ initialRate }: { initialRate: string }) {
  const router = useRouter();
  const [rate, setRate] = useState(initialRate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("system_settings")
      .update({ value: String(value) })
      .eq("key", "referral_commission_rate");
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="max-w-md">
      <p className="text-sm font-medium text-ink">Referral commission rate</p>
      <p className="mt-1 text-xs text-ink-soft">
        Percentage of each order&apos;s amount credited to the referring user&apos;s wallet, for every
        order their referrals ever place. Applies immediately to new orders — it does not
        change commissions already paid.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          Saved.
        </div>
      )}

      <form className="mt-4 flex items-end gap-2" onSubmit={handleSubmit}>
        <FormField
          label="Rate (%)"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={saving} className="mb-[1px]">
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
