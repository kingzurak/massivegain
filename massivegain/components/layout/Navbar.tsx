"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5" onClick={() => setOpen(false)}>
          <span className="font-display text-lg font-semibold text-navy-900">MassiveGain</span>
          <span className="font-display text-lg font-semibold text-brick-600">.ng</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-navy-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-ink-muted hover:text-navy-900">
            Log in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md border border-surface-border md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-4">
            <span
              className={cn(
                "absolute left-0 top-0 h-0.5 w-4 bg-navy-900 transition-transform",
                open && "translate-y-[6px] rotate-45"
              )}
            />
            <span
              className={cn("absolute left-0 top-[6px] h-0.5 w-4 bg-navy-900 transition-opacity", open && "opacity-0")}
            />
            <span
              className={cn(
                "absolute left-0 top-[12px] h-0.5 w-4 bg-navy-900 transition-transform",
                open && "-translate-y-[6px] -rotate-45"
              )}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-surface-border bg-surface md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-muted"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-md px-2 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link href="/register" onClick={() => setOpen(false)} className="mt-1">
              <Button className="w-full">Get started</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
