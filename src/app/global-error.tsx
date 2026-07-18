"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "1.5rem",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Wystąpił krytyczny błąd
          </h2>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#71717a",
              maxWidth: "28rem",
            }}
          >
            Aplikacja napotkała nieoczekiwany problem. Kliknij przycisk poniżej,
            aby spróbować ponownie.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "1px solid #e4e4e7",
              borderRadius: "0.375rem",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
