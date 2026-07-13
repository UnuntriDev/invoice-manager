import { NextRequest } from "next/server";
import { documentUpdateSchema } from "@/lib/validators/schemas";
import * as documentService from "@/lib/services/document.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await documentService.getDocument(id);
    if (!document) {
      return errorResponse({ code: "P2025" } as Error & { code: string });
    }
    return successResponse(document);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = documentUpdateSchema.parse(body);
    const document = await documentService.updateDocument(id, validated);
    return successResponse(document);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await documentService.deleteDocument(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
