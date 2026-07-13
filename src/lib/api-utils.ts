import { NextResponse } from "next/server";
import { z } from "zod";
import { DuplicateError } from "@/lib/services/document.service";
import { ValidationError } from "@/lib/services/upload.service";

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Błąd walidacji", details: error.flatten() },
      { status: 400 }
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  if (error instanceof DuplicateError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 }
    );
  }

  if (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  ) {
    return NextResponse.json(
      { error: "Nie znaleziono rekordu" },
      { status: 404 }
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: "Wystąpił błąd serwera" },
    { status: 500 }
  );
}
