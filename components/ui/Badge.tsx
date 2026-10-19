import { cn } from "@/lib/utils";

type Status = "pending" | "processing" | "completed" | "cancelled" | "active" | "inactive" | "suspended";

const statusStyles: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-surface-muted text-ink-soft border-surface-border",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-surface-muted text-ink-soft border-surface-border",
  suspended: "bg-brick-100 text-brick-700 border-red-200",
};

export default function Badge({ status, label }: { status: Status; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium capitalize",
        statusStyles[status]
      )}
    >
      {label ?? status}
    </span>
  );
}
