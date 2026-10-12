"use client";

import { useState, FormEvent } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";

const MIN_NAIRA = 100;
const MAX_NAIRA = 1_000_000;

export default function FundWalletForm() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const value = Number(amount);
    if (!Number.isInteger(value) || value < MIN_NAIRA || value > MAX_NAIRA) {
      setError(`Enter a whole amount between ₦${MIN_NAIRA.toLocaleString()} and ₦${MAX_NAIRA.toLocaleString()}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.authorizationUrl) {
        setError(json?.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      // Hand over to Paystack's secure payment page.
      window.location.href = json.authorizationUrl;
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-3 sm:flex-row">
      <FormField
        label="Amount (₦)"
        type="number"
        inputMode="numeric"
        min={MIN_NAIRA}
        placeholder="5000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={error ?? undefined}
        hint={`Minimum ₦${MIN_NAIRA.toLocaleString()}.`}
        className="sm:flex-1"
      />
      <Button type="submit" disabled={submitting} className="sm:mt-[26px] sm:self-start">
        {submitting ? "Redirecting…" : "Continue to Paystack"}
      </Button>
    </form>
  );
}
