import { NextRequest } from "next/server";
import { categoryUpdateSchema } from "@/lib/validators/schemas";
import * as categoryService from "@/lib/services/category.service";
import { successResponse, errorResponse, validateCuid } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    const body = await request.json();
    const validated = categoryUpdateSchema.parse(body);
    const category = await categoryService.updateCategory(id, validated);
    return successResponse(category);
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
    await categoryService.deleteCategory(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
