import { ReactNode } from "react";

export default function ErrorState({
  title = "Something went wrong",
  description = "That didn't work. Try again, and if it keeps happening, contact support.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-brick-100 px-6 py-14 text-center">
      <p className="font-display text-base text-brick-700">{title}</p>
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
