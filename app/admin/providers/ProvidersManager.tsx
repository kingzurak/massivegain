"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { formatNaira } from "@/lib/utils";
import type { Service } from "@/lib/supabase/types";

interface ImportResult {
  imported: number;
  skipped: number;
  categoriesCreated: number;
}

interface SyncResult {
  checked: number;
  updated: number;
  completed: number;
  cancelled: number;
  errors: number;
}

export default function ProvidersManager({
  balance,
  balanceError,
  markup,
  chargeFlat,
  services,
}: {
  balance: { balance: number; currency: string } | null;
  balanceError: string | null;
  markup: string;
  chargeFlat: string;
  services: Service[];
}) {
  const router = useRouter();

  const [markupValue, setMarkupValue] = useState(markup);
  const [flatValue, setFlatValue] = useState(chargeFlat);
  const [savingCharge, setSavingCharge] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveCharge() {
    setError(null);
    setNotice(null);
    const percent = Number(markupValue);
    if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
      setError("Enter a markup between 0 and 1000.");
      return;
    }
    const flat = Number(flatValue);
    if (!Number.isFinite(flat) || flat < 0) {
      setError("Enter a flat fee of 0 or more.");
      return;
    }
    setSavingCharge(true);
    const res = await fetch("/api/admin/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markupPercent: percent, chargeFlat: flat }),
    });
    const json = await res.json().catch(() => null);
    setSavingCharge(false);
    if (!res.ok) {
      setError(json?.error ?? "Couldn't save the default charge.");
      return;
    }
    setNotice(`Default charge saved: ${percent}% + ${formatNaira(flat)} per 1,000.`);
    router.refresh();
  }

  async function runImport() {
    setError(null);
    setNotice(null);
    setImporting(true);
    const res = await fetch("/api/admin/providers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markupPercent: Number(markupValue) }),
    });
    const json = await res.json().catch(() => null);
    setImporting(false);
    if (!res.ok) {
      setError(json?.error ?? "Couldn't import the catalogue.");
      return;
    }
    const result = json as ImportResult | null;
    if (result) {
      setNotice(
        `Imported ${result.imported} service${result.imported === 1 ? "" : "s"}` +
          (result.skipped ? `, skipped ${result.skipped} already mapped` : "") +
          (result.categoriesCreated ? `, created ${result.categoriesCreated} categor${result.categoriesCreated === 1 ? "y" : "ies"}` : "") +
          `. They're live and orderable now.`
      );
    }
    router.refresh();
  }

  async function runSync() {
    setError(null);
    setNotice(null);
    setSyncing(true);
    const res = await fetch("/api/admin/providers/sync", { method: "POST" });
    const json = await res.json().catch(() => null);
    setSyncing(false);
    if (!res.ok) {
      setError(json?.error ?? "Couldn't sync order statuses.");
      return;
    }
    const result = json as SyncResult | null;
    if (result) {
      setNotice(
        `Checked ${result.checked} open order${result.checked === 1 ? "" : "s"} — ` +
          `${result.completed} completed, ${result.cancelled} cancelled by the provider` +
          (result.errors ? `, ${result.errors} error${result.errors === 1 ? "" : "s"}` : "") +
          "."
      );
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">bestclout balance</p>
            <Badge status={balanceError ? "suspended" : "active"} label={balanceError ? "unreachable" : "connected"} />
          </div>
          <p className="mt-3 font-display text-2xl text-ink">
            {balance
              ? balance.currency === "NGN"
                ? formatNaira(balance.balance)
                : `${balance.balance.toLocaleString()} ${balance.currency}`
              : "—"}
          </p>
          {balanceError && <p className="mt-2 text-xs text-brick-700">{balanceError}</p>}
          <p className="mt-3 text-xs text-ink-soft">
            The provider account is funded in NGN. Orders fail upstream when this is too low to cover them.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-ink">Catalogue</p>
          <p className="mt-3 font-display text-2xl text-ink">
            {services.length} mapped service{services.length === 1 ? "" : "s"}
          </p>
          <p className="mt-3 text-xs text-ink-soft">
            Only Default-type bestclout services are imported and auto-fulfilled. Imports go live
            immediately at your default charge; adjust cost, charge and prices anytime in Services.
          </p>
        </Card>
      </div>

      <Card>
        <p className="text-sm font-medium text-ink">Default charge &amp; import</p>
        <p className="mt-1 text-xs text-ink-soft">
          Our charge is added to the provider&apos;s NGN cost to set the price: cost &times; (1 + markup) + flat,
          rounded to the kobo. A service can override either part in Services. Changing this does not reprice
          services already imported — edit those in Services.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <FormField
            label="Markup (%)"
            type="number"
            min={0}
            max={1000}
            step="1"
            value={markupValue}
            onChange={(e) => setMarkupValue(e.target.value)}
            className="w-28"
          />
          <FormField
            label="Flat fee (₦/1,000)"
            type="number"
            min={0}
            step="1"
            value={flatValue}
            onChange={(e) => setFlatValue(e.target.value)}
            className="w-32"
          />
          <Button variant="outline" onClick={saveCharge} disabled={savingCharge}>
            {savingCharge ? "Saving…" : "Save default"}
          </Button>
          <Button onClick={runImport} disabled={importing}>
            {importing ? "Importing…" : "Import new services"}
          </Button>
          <Button variant="secondary" onClick={runSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync order statuses"}
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 font-display text-lg text-ink">Mapped services</h2>
        {services.length === 0 ? (
          <EmptyState
            title="Nothing mapped yet"
            description="Import the bestclout catalogue to create services here."
          />
        ) : (
          <Table>
            <THead>
              <TRow>
                <TH>Service</TH>
                <TH>Provider ID</TH>
                <TH>Provider rate / 1,000</TH>
                <TH>Your price / 1,000</TH>
                <TH>Type</TH>
                <TH>Status</TH>
              </TRow>
            </THead>
            <tbody>
              {services.map((service) => (
                <TRow key={service.id}>
                  <TD className="font-medium">{service.name}</TD>
                  <TD>{service.provider_service_id ?? "—"}</TD>
                  <TD>{service.provider_rate != null ? formatNaira(service.provider_rate) : "—"}</TD>
                  <TD>{formatNaira(service.price_per_thousand)}</TD>
                  <TD>{service.provider_service_type ?? "—"}</TD>
                  <TD>
                    <Badge status={service.active ? "active" : "inactive"} />
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
