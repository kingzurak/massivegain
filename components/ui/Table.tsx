import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full min-w-[560px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-muted text-left text-xs font-medium text-ink-soft">{children}</thead>;
}

export function TRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-t border-surface-border", className)}>{children}</tr>;
}

export function TH({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-ink", className)}>{children}</td>;
}
