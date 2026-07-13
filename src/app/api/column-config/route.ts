import { NextRequest } from "next/server";
import { columnConfigUpdateSchema } from "@/lib/validators/schemas";
import * as columnConfigService from "@/lib/services/column-config.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const config = await columnConfigService.getColumnConfig();
    return successResponse(config);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = columnConfigUpdateSchema.parse(body);
    const config = await columnConfigService.updateColumnConfig(validated.columns);
    return successResponse(config);
  } catch (error) {
    return errorResponse(error);
  }
}
