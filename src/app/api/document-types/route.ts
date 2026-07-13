import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { documentTypeCreateSchema } from "@/lib/validators/schemas";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const types = await prisma.documentType.findMany({
      orderBy: { name: "asc" },
    });
    return successResponse(types);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = documentTypeCreateSchema.parse(body);
    const type = await prisma.documentType.create({ data: validated });
    return successResponse(type, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
