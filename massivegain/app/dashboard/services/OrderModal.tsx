"use client";

import { useMemo, useState, FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { formatNaira } from "@/lib/utils";
import type { ServiceWithCategory } from "@/lib/supabase/types";

export default function OrderModal({
  service,
  walletBalance,
  onClose,
  onSuccess,
}: {
  service: ServiceWithCategory;
  walletBalance: number;
  onClose: () => void;
  onSuccess: (result: { amount: number; balance: number; orderNumber: string }) => void;
}) {
  const [quantity, setQuantity] = useState(String(service.min_quantity));
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityNum = Number(quantity);
  const estimatedTotal =
    Number.isFinite(quantityNum) && quantityNum > 0
      ? Math.round(((service.price_per_thousand * quantityNum) / 1000) * 100) / 100
      : 0;
  const exceedsBalance = estimatedTotal > walletBalance;

  const quantityValid =
    Number.isInteger(quantityNum) &&
    quantityNum >= service.min_quantity &&
    quantityNum <= service.max_quantity;

  const linkValid = /^https?:\/\/.+/i.test(link.trim());

  // Stable for this modal session so a retried submit (e.g. after a dropped
  // connection) can't charge the wallet twice.
  const reference = useMemo(() => `ord_${crypto.randomUUID().replace(/-/g, "")}`, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!quantityValid) {
      setError(
        `Enter a quantity between ${service.min_quantity.toLocaleString()} and ${service.max_quantity.toLocaleString()}.`
      );
      return;
    }
    if (!linkValid) {
      setError("Enter the link this order is for, starting with http:// or https://.");
      return;
    }
    if (exceedsBalance) {
      setError("Your wallet balance isn't enough for this order.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, quantity: quantityNum, reference, link: link.trim() }),
      });
      const json = await res.json().catch(() => null);
      setSubmitting(false);

      if (!res.ok || !json || json.error) {
        setError(json?.error ?? "Couldn't place that order. Try again.");
        return;
      }

      onSuccess({
        amount: json.amount ?? estimatedTotal,
        balance: json.balance ?? walletBalance,
        orderNumber: json.orderNumber ?? "",
      });
    } catch {
      setSubmitting(false);
      setError("Couldn't connect. Check your internet and try again.");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Order — ${service.name}`}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="order-service-form" disabled={submitting}>
            {submitting ? "Placing order…" : "Place order"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} id="order-service-form">
        <FormField
          label="Link"
          type="url"
          placeholder="https://instagram.com/yourpage"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          hint="The profile, post or page this order is for."
          maxLength={2048}
          required
        />

        <FormField
          label="Quantity"
          type="number"
          inputMode="numeric"
          min={service.min_quantity}
          max={service.max_quantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          hint={`Min ${service.min_quantity.toLocaleString()} · Max ${service.max_quantity.toLocaleString()}`}
          required
        />

        <div className="flex items-center justify-between rounded-md bg-surface-muted px-3.5 py-3 text-sm">
          <span className="text-ink-soft">Estimated total</span>
          <span className="font-display text-base text-navy-900">{formatNaira(estimatedTotal)}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span>Wallet balance</span>
          <span className={exceedsBalance ? "font-medium text-brick-700" : ""}>
            {formatNaira(walletBalance)}
          </span>
        </div>
      </form>
    </Modal>
  );
}
