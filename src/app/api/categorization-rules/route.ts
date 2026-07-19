import { NextRequest } from "next/server";
import { categorizationRuleCreateSchema } from "@/lib/validators/schemas";
import * as ruleService from "@/lib/services/categorization-rule.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const rules = await ruleService.listCategorizationRules();
    return successResponse(rules);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = categorizationRuleCreateSchema.parse(body);
    const rule = await ruleService.createCategorizationRule(validated);
    return successResponse(rule, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
