import prisma from "@/lib/prisma";
import { getZonedDateTimeParts } from "@/lib/cron/timezone";
import {
  executeKSeFSchedule,
  type ScheduleExecutionResult,
} from "@/lib/services/schedule-runner.service";

export async function runCronTick(
  currentTime = new Date()
): Promise<ScheduleExecutionResult[]> {
  const { hour, minute } = getZonedDateTimeParts(currentTime);
  const schedules = await prisma.kSeFSchedule.findMany({
    where: { isActive: true, hour, minute },
  });
  const results: ScheduleExecutionResult[] = [];

  for (const schedule of schedules) {
    const result = await executeKSeFSchedule(schedule);
    results.push(result);

    if (result.status === "failed") {
      console.error("[CRON] Harmonogram KSeF zakończony błędem", {
        scheduleId: schedule.id,
        error: result.error,
      });
    } else if (result.status === "success") {
      console.info("[CRON] Harmonogram KSeF zakończony sukcesem", {
        scheduleId: schedule.id,
        completedAt: result.completedAt.toISOString(),
      });
    }
  }

  return results;
}
