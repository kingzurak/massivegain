import Link from "next/link";
import Button from "@/components/ui/Button";

function initialsFrom(nameOrEmail: string) {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed[0].toUpperCase();
}

export default function TopBar({
  context,
  userName,
  userEmail,
}: {
  context: "Dashboard" | "Admin";
  userName?: string | null;
  userEmail: string;
}) {
  const displayName = userName && userName.trim() ? userName : userEmail;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-border bg-surface/95 px-4 backdrop-blur md:px-6">
      <Link href="/" className="flex items-center gap-1.5">
        <span className="font-display text-base font-semibold text-navy-900">MassiveGain</span>
        <span className="font-display text-base font-semibold text-brick-600">.ng</span>
        <span className="ml-2 hidden rounded-sm bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft sm:inline">
          {context}
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden max-w-[160px] truncate text-sm text-ink-muted sm:inline">
          {displayName}
        </span>
        <div className="h-8 w-8 shrink-0 rounded-full bg-navy-900 text-center text-sm font-medium leading-8 text-white">
          {initialsFrom(displayName)}
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
