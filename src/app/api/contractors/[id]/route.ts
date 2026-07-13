import { NextRequest } from "next/server";
import { contractorUpdateSchema } from "@/lib/validators/schemas";
import * as contractorService from "@/lib/services/contractor.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractor = await contractorService.getContractor(id);
    if (!contractor) {
      return errorResponse({ code: "P2025" } as Error & { code: string });
    }
    return successResponse(contractor);
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
    const validated = contractorUpdateSchema.parse(body);
    const contractor = await contractorService.updateContractor(id, validated);
    return successResponse(contractor);
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
    await contractorService.deleteContractor(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
