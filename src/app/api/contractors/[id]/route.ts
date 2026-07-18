import { NextRequest } from "next/server";
import { contractorUpdateSchema } from "@/lib/validators/schemas";
import * as contractorService from "@/lib/services/contractor.service";
import { successResponse, errorResponse, validateCuid } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    const contractor = await contractorService.getContractor(id);
    if (!contractor) {
      return errorResponse(
        Object.assign(new Error("Nie znaleziono kontrahenta"), {
          code: "P2025",
        }),
      );
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
    const invalid = validateCuid(id);
    if (invalid) return invalid;
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
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    await contractorService.deleteContractor(id);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
