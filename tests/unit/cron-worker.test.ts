const mockCronSchedule = jest.fn();
const mockRunCronTick = jest.fn();
const mockReconcileOrphanedAttachments = jest.fn();

jest.mock("node-cron", () => ({
  __esModule: true,
  default: { schedule: mockCronSchedule },
}));

jest.mock("@/lib/cron/schedule-worker", () => ({
  runCronTick: mockRunCronTick,
}));

jest.mock("@/lib/services/attachment-reconciliation.service", () => ({
  reconcileOrphanedAttachments: mockReconcileOrphanedAttachments,
}));

import { startCronWorker } from "@/lib/cron/worker";

describe("cron worker configuration", () => {
  it("configures every task with explicit timezone and local overlap protection", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    startCronWorker();

    expect(mockCronSchedule).toHaveBeenCalledTimes(2);
    for (const call of mockCronSchedule.mock.calls) {
      expect(call[2]).toEqual({
        timezone: "Europe/Warsaw",
        noOverlap: true,
      });
    }
    logSpy.mockRestore();
  });
});
