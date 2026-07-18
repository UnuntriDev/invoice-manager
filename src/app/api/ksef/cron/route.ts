import { NextRequest, NextResponse } from "next/server";
import { runCronTick } from "@/lib/cron/schedule-worker";
import { successResponse } from "@/lib/api-utils";
import { timingSafeEqual } from "node:crypto";

function verifyBearerToken(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!verifyBearerToken(request)) {
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
