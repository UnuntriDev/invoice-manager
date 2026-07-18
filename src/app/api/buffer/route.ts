import * as bufferService from "@/lib/services/buffer.service";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { bufferListQuerySchema } from "@/lib/validators/schemas";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const params = bufferListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const documents = await bufferService.listBufferDocuments(params);
    return successResponse(documents);
  } catch (error) {
    return errorResponse(error);
  }
}
