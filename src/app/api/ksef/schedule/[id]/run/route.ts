import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { executeKSeFSchedule } from "@/lib/services/schedule-runner.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const schedule = await prisma.kSeFSchedule.findUnique({ where: { id } });
    if (!schedule) {
      return NextResponse.json(
        { error: "Nie znaleziono harmonogramu" },
        { status: 404 }
      );
    }

    const result = await executeKSeFSchedule(schedule);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
