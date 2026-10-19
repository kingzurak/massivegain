"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

export default function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-surface-border bg-surface px-3 py-2 md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[40px] shrink-0 items-center rounded-full px-3.5 text-xs font-medium",
              active ? "bg-navy-900 text-white" : "bg-surface-muted text-ink-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
