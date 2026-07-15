import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ksefScheduleSchema } from "@/lib/validators/schemas";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const schedules = await prisma.kSeFSchedule.findMany({
      orderBy: { hour: "asc" },
      select: {
        id: true,
        hour: true,
        minute: true,
        isActive: true,
        fetchType: true,
        lastRunAt: true,
        lastError: true,
        lastErrorAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return successResponse(schedules);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ksefScheduleSchema.parse(body);
    const schedule = await prisma.kSeFSchedule.create({ data: validated });
    return successResponse(schedule, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
