import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ksefScheduleSchema } from "@/lib/validators/schemas";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = ksefScheduleSchema.parse(body);
    const schedule = await prisma.kSeFSchedule.update({
      where: { id },
      data: validated,
    });
    return successResponse(schedule);
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
    await prisma.kSeFSchedule.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
