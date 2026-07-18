"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryErrorState({
  title,
  error,
  onRetry,
  isRetrying = false,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 py-14 text-center"
      role="alert"
    >
      <TriangleAlert className="mb-3 size-10 text-destructive" aria-hidden="true" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Spróbuj ponownie."}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onRetry}
        disabled={isRetrying}
      >
        <RotateCcw aria-hidden="true" />
        Spróbuj ponownie
      </Button>
    </div>
  );
}
