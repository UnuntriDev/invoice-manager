import { NextRequest } from "next/server";
import { runCronTick } from "@/lib/cron/schedule-worker";
import { successResponse } from "@/lib/api-utils";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") ||
    request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  try {
    const results = await runCronTick(new Date());
    return successResponse(results);
  } catch (error) {
    console.error("[CRON] Błąd:", error);
    return NextResponse.json({ error: "Błąd wykonania crona" }, { status: 500 });
  }
}
