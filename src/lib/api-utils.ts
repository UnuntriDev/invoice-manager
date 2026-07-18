import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CategoryValidationError,
  ConflictError,
  DuplicateError,
  PayloadTooLargeError,
  ValidationError,
} from "@/lib/errors/validation-errors";

const CUID_RE = /^c[a-z0-9]{24}$/;

export function validateCuid(id: string): NextResponse | null {
  if (!CUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Nieprawidłowy identyfikator zasobu" },
      { status: 400 },
    );
  }
  return null;
}

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Nieprawidłowy JSON w treści żądania" },
      { status: 400 },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Błąd walidacji", details: error.flatten() },
      { status: 400 }
    );
  }

  if (error instanceof ValidationError || error instanceof CategoryValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  if (error instanceof PayloadTooLargeError) {
    return NextResponse.json({ error: error.message }, { status: 413 });
  }

  if (error instanceof DuplicateError || error instanceof ConflictError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 }
    );
  }

  const prismaCode =
    error instanceof Error && "code" in error
      ? (error as { code: string }).code
      : null;
  if (prismaCode === "P2025") {
    return NextResponse.json(
      { error: "Nie znaleziono rekordu" },
      { status: 404 }
    );
  }

  if (prismaCode === "P2002" || prismaCode === "P2034") {
    return NextResponse.json(
      { error: "Rekord o tych danych już istnieje" },
      { status: 409 },
    );
  }
  if (prismaCode === "P2003") {
    return NextResponse.json(
      { error: "Operacja narusza istniejące powiązania danych" },
      { status: 409 },
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: "Wystąpił błąd serwera" },
    { status: 500 }
  );
}
