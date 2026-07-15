import { randomUUID } from "crypto";
import type { KSeFSchedule } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { fetchFromKSeF, type KSeFImportResult } from "@/lib/services/ksef.service";
import {
  formatZonedIsoDate,
  getPreviousCalendarDate,
} from "@/lib/cron/timezone";

const LOCK_TTL_MS = 30 * 60 * 1000;

export type ScheduleDefinition = Pick<
  KSeFSchedule,
  "id" | "isActive" | "fetchType" | "lastRunAt"
>;

export type ScheduleExecutionResult =
  | {
      status: "success";
      scheduleId: string;
      completedAt: Date;
      results: Array<{ type: "COST" | "SALES" } & KSeFImportResult>;
    }
  | {
      status: "skipped";
      scheduleId: string;
      reason: "already-running-or-inactive";
    }
  | {
      status: "failed";
      scheduleId: string;
      error: string;
      results: Array<{ type: "COST" | "SALES" } & KSeFImportResult>;
    };

interface RunnerDependencies {
  now?: () => Date;
  createLockToken?: () => string;
  fetch?: typeof fetchFromKSeF;
}

function getFetchTypes(fetchType: string): Array<"COST" | "SALES"> {
  if (fetchType === "BOTH") return ["COST", "SALES"];
  if (fetchType === "COST" || fetchType === "SALES") return [fetchType];
  throw new Error(`Nieobsługiwany typ harmonogramu KSeF: ${fetchType}`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDateRange(schedule: ScheduleDefinition, startedAt: Date) {
  const dateTo = formatZonedIsoDate(startedAt);
  const candidateFrom = schedule.lastRunAt
    ? formatZonedIsoDate(schedule.lastRunAt)
    : getPreviousCalendarDate(dateTo);

  return {
    dateFrom: candidateFrom <= dateTo
      ? candidateFrom
      : getPreviousCalendarDate(dateTo),
    dateTo,
  };
}

export async function executeKSeFSchedule(
  schedule: ScheduleDefinition,
  dependencies: RunnerDependencies = {}
): Promise<ScheduleExecutionResult> {
  const now = dependencies.now ?? (() => new Date());
  const fetch = dependencies.fetch ?? fetchFromKSeF;
  const lockToken = (dependencies.createLockToken ?? randomUUID)();
  const startedAt = now();
  const expiresBefore = new Date(startedAt.getTime() - LOCK_TTL_MS);

  const acquired = await prisma.kSeFSchedule.updateMany({
    where: {
      id: schedule.id,
      isActive: true,
      OR: [
        { lockToken: null },
        { lockedAt: null },
        { lockedAt: { lt: expiresBefore } },
      ],
    },
    data: { lockToken, lockedAt: startedAt },
  });

  if (acquired.count !== 1) {
    return {
      status: "skipped",
      scheduleId: schedule.id,
      reason: "already-running-or-inactive",
    };
  }

  const results: Array<{ type: "COST" | "SALES" } & KSeFImportResult> = [];

  try {
    const dateRange = getDateRange(schedule, startedAt);
    const types = getFetchTypes(schedule.fetchType);

    for (const [index, type] of types.entries()) {
      if (index > 0) {
        const renewed = await prisma.kSeFSchedule.updateMany({
          where: { id: schedule.id, lockToken },
          data: { lockedAt: now() },
        });
        if (renewed.count !== 1) {
          throw new Error("Utracono blokadę harmonogramu podczas wykonania");
        }
      }

      const result = await fetch({ ...dateRange, type });
      results.push({ type, ...result });
      if (!result.success) {
        throw new Error(`KSeF ${type}: ${result.error}`);
      }
    }

    const completedAt = now();
    const completed = await prisma.kSeFSchedule.updateMany({
      where: { id: schedule.id, lockToken },
      data: {
        lastRunAt: completedAt,
        lastError: null,
        lastErrorAt: null,
        lockToken: null,
        lockedAt: null,
      },
    });
    if (completed.count !== 1) {
      throw new Error("Nie udało się zatwierdzić wykonania — blokada wygasła");
    }

    return { status: "success", scheduleId: schedule.id, completedAt, results };
  } catch (error) {
    const message = getErrorMessage(error);
    const failedAt = now();

    try {
      const persisted = await prisma.kSeFSchedule.updateMany({
        where: { id: schedule.id, lockToken },
        data: {
          lastError: message,
          lastErrorAt: failedAt,
          lockToken: null,
          lockedAt: null,
        },
      });
      if (persisted.count !== 1) {
        console.error("[CRON] Nie zapisano błędu — runner utracił blokadę", {
          scheduleId: schedule.id,
          error: message,
        });
      }
    } catch (persistenceError) {
      console.error("[CRON] Nie udało się zapisać błędu harmonogramu", {
        scheduleId: schedule.id,
        error: message,
        persistenceError,
      });
    }

    return { status: "failed", scheduleId: schedule.id, error: message, results };
  }
}
