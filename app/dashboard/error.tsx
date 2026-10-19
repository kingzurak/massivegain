"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <ErrorState
      title="Couldn't load this page"
      description="Something went wrong loading your dashboard. Try again, or head back to the overview."
      action={
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Back to overview
          </Button>
          <Button onClick={reset}>Try again</Button>
        </div>
      }
    />
  );
}
