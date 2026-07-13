import { NextRequest } from "next/server";
import { contractorCreateSchema } from "@/lib/validators/schemas";
import * as contractorService from "@/lib/services/contractor.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const contractors = await contractorService.listContractors();
    return successResponse(contractors);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = contractorCreateSchema.parse(body);
    const contractor = await contractorService.createContractor(validated);
    return successResponse(contractor, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
