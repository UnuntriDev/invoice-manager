import { NextRequest } from "next/server";
import { documentUpdateSchema } from "@/lib/validators/schemas";
import * as documentService from "@/lib/services/document.service";
import { successResponse, errorResponse, validateCuid } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    const document = await documentService.getDocument(id);
    if (!document) {
      return errorResponse(
        Object.assign(new Error("Nie znaleziono dokumentu"), { code: "P2025" }),
      );
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
    const invalid = validateCuid(id);
    if (invalid) return invalid;
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
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    await documentService.deleteDocument(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
