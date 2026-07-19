import { NextRequest } from "next/server";
import { categorizationRuleUpdateSchema } from "@/lib/validators/schemas";
import * as ruleService from "@/lib/services/categorization-rule.service";
import { successResponse, errorResponse, validateCuid } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    const body = await request.json();
    const validated = categorizationRuleUpdateSchema.parse(body);
    const rule = await ruleService.updateCategorizationRule(id, validated);
    return successResponse(rule);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    await ruleService.deleteCategorizationRule(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
