"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

export default function Sidebar({
  items,
  homeHref,
  homeLabel,
}: {
  items: NavItem[];
  homeHref: string;
  homeLabel: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-surface-border bg-surface md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col justify-between p-4">
        <div>
          <p className="px-2 pb-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
            {homeLabel}
          </p>
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-brick-600 bg-navy-900/[0.04] text-navy-900"
                      : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-navy-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link href={homeHref} className="px-2 text-xs text-ink-soft hover:text-navy-900">
          ← Back to MassiveGain.ng
        </Link>
      </div>
    </aside>
  );
}
