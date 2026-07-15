const mockFindMany = jest.fn();
const mockExecuteKSeFSchedule = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    kSeFSchedule: { findMany: mockFindMany },
  },
}));

jest.mock("@/lib/services/schedule-runner.service", () => ({
  executeKSeFSchedule: mockExecuteKSeFSchedule,
}));

import { runCronTick } from "@/lib/cron/schedule-worker";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("cron schedule selection", () => {
  it("selects schedules using Warsaw time rather than server-local time", async () => {
    mockFindMany.mockResolvedValue([]);

    await runCronTick(new Date("2026-07-15T04:30:00.000Z"));

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true, hour: 6, minute: 30 },
    });
  });
});
