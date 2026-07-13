import { NextRequest } from "next/server";
import { acceptDocumentsSchema } from "@/lib/validators/schemas";
import * as bufferService from "@/lib/services/buffer.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentIds } = acceptDocumentsSchema.parse(body);
    const count = await bufferService.acceptDocuments(documentIds);
    return successResponse({ accepted: count });
  } catch (error) {
    return errorResponse(error);
  }
}
