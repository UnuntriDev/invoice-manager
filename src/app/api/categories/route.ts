import { NextRequest } from "next/server";
import { categoryCreateSchema } from "@/lib/validators/schemas";
import * as categoryService from "@/lib/services/category.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const tree = await categoryService.getCategoryTree();
    return successResponse(tree);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = categoryCreateSchema.parse(body);
    const category = await categoryService.createCategory(validated);
    return successResponse(category, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
