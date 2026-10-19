"use client";

import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  // Lock background scroll while open — without this, iOS/Android let the
  // page behind a fixed-position overlay keep scrolling underneath it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4">
      <div
        className={cn(
          "flex w-full max-w-md flex-col rounded-t-xl bg-surface shadow-raised sm:rounded-xl",
          "max-h-[85vh] sm:max-h-[85vh]",
          "animate-in"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <h3 className="font-display text-lg text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4 text-sm text-ink-muted">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-surface-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
