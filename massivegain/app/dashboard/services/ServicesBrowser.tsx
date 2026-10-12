"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OrderModal from "./OrderModal";
import { cn, formatNaira } from "@/lib/utils";
import type { ServiceWithCategory } from "@/lib/supabase/types";

export default function ServicesBrowser({
  services,
  isLoggedIn,
  walletBalance,
}: {
  services: ServiceWithCategory[];
  isLoggedIn: boolean;
  walletBalance: number | null;
}) {
  const router = useRouter();

  const categoryNames = Array.from(
    new Set(services.map((s) => s.category?.name ?? "Uncategorized"))
  );
  const [category, setCategory] = useState("All");
  const [orderingService, setOrderingService] = useState<ServiceWithCategory | null>(null);
  const [balance, setBalance] = useState(walletBalance ?? 0);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const filtered =
    category === "All"
      ? services
      : services.filter((s) => (s.category?.name ?? "Uncategorized") === category);

  return (
    <>
      {successNotice && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          {successNotice}
        </div>
      )}

      {isLoggedIn && (
        <p className="mt-6 text-sm text-ink-muted">
          Wallet balance: <span className="font-medium text-navy-900">{formatNaira(balance)}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {["All", ...categoryNames].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              category === c
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-surface-border bg-surface text-ink-muted hover:border-navy-600"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((service) => (
          <Card key={service.id} className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-ink-soft">
                {service.category?.name ?? "Uncategorized"}
              </p>
              <h3 className="mt-2 text-base font-medium text-ink">{service.name}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{service.description}</p>
            </div>

            <div className="mt-5 border-t border-surface-border pt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-navy-900">
                  {formatNaira(service.price_per_thousand)}
                </span>
                <span className="text-xs text-ink-soft">per 1,000</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Min {service.min_quantity.toLocaleString()} · Max{" "}
                {service.max_quantity.toLocaleString()}
              </p>

              {isLoggedIn ? (
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    setSuccessNotice(null);
                    setOrderingService(service);
                  }}
                >
                  Order this service
                </Button>
              ) : (
                <Link href={`/login?redirectTo=/services`} className="mt-4 block">
                  <Button className="w-full" variant="outline">
                    Log in to order
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>

      {orderingService && (
        <OrderModal
          service={orderingService}
          walletBalance={balance}
          onClose={() => setOrderingService(null)}
          onSuccess={({ amount, balance: newBalance, orderNumber }) => {
            setBalance(newBalance);
            setOrderingService(null);
            setSuccessNotice(
              `Order ${orderNumber} placed for ${formatNaira(amount)}. View it in your order history.`
            );
            router.refresh();
          }}
        />
      )}
    </>
  );
}
