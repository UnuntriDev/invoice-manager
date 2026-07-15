import { NextRequest, NextResponse } from "next/server";
import { ksefFetchSchema } from "@/lib/validators/schemas";
import * as ksefService from "@/lib/services/ksef.service";

function ksefErrorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return ksefErrorResponse("Nieprawidłowy format JSON", 400);
  }

  const validation = ksefFetchSchema.safeParse(body);
  if (!validation.success) {
    return ksefErrorResponse(
      validation.error.issues[0]?.message ?? "Błędne dane wejściowe",
      400
    );
  }

  try {
    const validated = validation.data;
    const result = await ksefService.fetchFromKSeF({
      dateFrom: validated.dateFrom.toISOString().split("T")[0],
      dateTo: validated.dateTo.toISOString().split("T")[0],
      type: validated.type,
    });

    if (!result.success) {
      const status = result.error.startsWith("Nie udało się połączyć z KSeF")
        ? 502
        : 500;
      return ksefErrorResponse(result.error, status);
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[KSeF] Unhandled route error:", error);
    return ksefErrorResponse("Wystąpił błąd serwera", 500);
  }
}
