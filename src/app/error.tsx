"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CircleAlert, RotateCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <CircleAlert className="mb-4 size-14 text-destructive" aria-hidden="true" />
      <h2 className="text-xl font-semibold">Coś poszło nie tak</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message || "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground/60">
          Kod błędu: {error.digest}
        </p>
      )}
      <Button className="mt-6" variant="outline" onClick={reset}>
        <RotateCw className="mr-2 size-4" aria-hidden="true" />
        Spróbuj ponownie
      </Button>
    </div>
  );
}
