import { NextRequest } from "next/server";
import {
  documentCreateSchema,
  documentListQuerySchema,
} from "@/lib/validators/schemas";
import * as documentService from "@/lib/services/document.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const params = documentListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const page = await documentService.listAcceptedDocuments(params);
    return successResponse(page);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = documentCreateSchema.parse(body);
    const document = await documentService.createDocument(validated);
    return successResponse(document, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
