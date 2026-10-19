export default function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-border border-t-brick-600" />
      {label}…
    </div>
  );
}
