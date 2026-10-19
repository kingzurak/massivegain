"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import type { AdminOrderRow } from "./OrdersManager";

export default function FulfilmentModal({
  order,
  onClose,
}: {
  order: AdminOrderRow;
  onClose: () => void;
}) {
  const router = useRouter();

  const [externalOrderId, setExternalOrderId] = useState(order.external_order_id ?? "");
  const [startCount, setStartCount] = useState(order.start_count?.toString() ?? "");
  const [link, setLink] = useState(order.link ?? "");
  const [notes, setNotes] = useState(order.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/admin/orders/fulfilment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        externalOrderId: externalOrderId.trim(),
        startCount: startCount.trim(),
        link: link.trim(),
        adminNotes: notes,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setError(json?.error ?? "Couldn't save those details.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Fulfilment — ${order.order_number}`}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="fulfilment-form" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-ink-soft">
        Fulfilment provider: <span className="font-medium capitalize text-ink">{order.provider}</span>
        {order.provider === "manual" && " — no external API is connected, fill these in by hand."}
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSave} id="fulfilment-form">
        <FormField
          label="External order ID"
          placeholder="e.g. the order ID from the provider you used"
          value={externalOrderId}
          onChange={(e) => setExternalOrderId(e.target.value)}
        />
        <FormField
          label="Start count"
          type="number"
          placeholder="Count on the account before this order began"
          value={startCount}
          onChange={(e) => setStartCount(e.target.value)}
        />
        <FormField
          label="Link"
          placeholder="https://..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          hint="Pre-filled from what the customer submitted — edit if needed."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-notes" className="text-sm font-medium text-ink">
            Notes
          </label>
          <textarea
            id="admin-notes"
            rows={3}
            className="rounded-md border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
