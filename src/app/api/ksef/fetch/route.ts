import { NextRequest } from "next/server";
import { ksefFetchSchema } from "@/lib/validators/schemas";
import * as ksefService from "@/lib/services/ksef.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ksefFetchSchema.parse(body);
    const result = await ksefService.fetchFromKSeF({
      dateFrom: validated.dateFrom.toISOString().split("T")[0],
      dateTo: validated.dateTo.toISOString().split("T")[0],
      type: validated.type,
    });
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
