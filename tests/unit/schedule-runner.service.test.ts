const mockUpdateMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    kSeFSchedule: { updateMany: mockUpdateMany },
  },
}));

import { executeKSeFSchedule } from "@/lib/services/schedule-runner.service";

const fixedNow = new Date("2026-07-15T08:00:00.000Z");
const baseSchedule = {
  id: "schedule-1",
  isActive: true,
  fetchType: "COST",
  lastRunAt: null,
};
const successResult = {
  success: true as const,
  total: 1,
  imported: 1,
  skipped: 0,
};

const dependencies = {
  now: () => fixedNow,
  createLockToken: () => "lock-token",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("distributed KSeF schedule execution", () => {
  it("allows only one parallel execution of the same schedule", async () => {
    let finishFetch!: (value: typeof successResult) => void;
    const pendingFetch = new Promise<typeof successResult>((resolve) => {
      finishFetch = resolve;
    });
    const fetch = jest.fn().mockReturnValue(pendingFetch);
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const firstRun = executeKSeFSchedule(baseSchedule, {
      ...dependencies,
      fetch,
    });
    await Promise.resolve();
    const secondRun = await executeKSeFSchedule(baseSchedule, {
      ...dependencies,
      createLockToken: () => "second-lock-token",
      fetch,
    });

    expect(secondRun).toEqual({
      status: "skipped",
      scheduleId: "schedule-1",
      reason: "already-running-or-inactive",
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    finishFetch(successResult);
    await expect(firstRun).resolves.toMatchObject({ status: "success" });
  });

  it("supports a safe retry after a failed execution", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce({ success: false, error: "KSeF unavailable" })
      .mockResolvedValueOnce(successResult);

    const firstRun = await executeKSeFSchedule(baseSchedule, {
      ...dependencies,
      fetch,
    });
    const retry = await executeKSeFSchedule(baseSchedule, {
      ...dependencies,
      createLockToken: () => "retry-lock-token",
      fetch,
    });

    expect(firstRun).toMatchObject({
      status: "failed",
      error: "KSeF COST: KSeF unavailable",
    });
    expect(retry).toMatchObject({ status: "success" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not update lastRunAt when the second half of a BOTH job fails", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(successResult)
      .mockResolvedValueOnce({ success: false, error: "sales import failed" });

    const result = await executeKSeFSchedule(
      { ...baseSchedule, fetchType: "BOTH" },
      { ...dependencies, fetch }
    );

    expect(result).toMatchObject({
      status: "failed",
      error: "KSeF SALES: sales import failed",
    });
    expect(
      mockUpdateMany.mock.calls.some(
        ([query]) => query.data && "lastRunAt" in query.data
      )
    ).toBe(false);
    expect(mockUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: "KSeF SALES: sales import failed",
          lockToken: null,
          lockedAt: null,
        }),
      })
    );
  });

  it("updates lastRunAt and clears the previous error only after full success", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const fetch = jest.fn().mockResolvedValue(successResult);

    const result = await executeKSeFSchedule(
      { ...baseSchedule, fetchType: "BOTH" },
      { ...dependencies, fetch }
    );

    expect(result).toMatchObject({ status: "success", completedAt: fixedNow });
    expect(mockUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "schedule-1", lockToken: "lock-token" },
      data: {
        lastRunAt: fixedNow,
        lastError: null,
        lastErrorAt: null,
        lockToken: null,
        lockedAt: null,
      },
    });
  });

  it("retries from the last successful local date instead of losing a failed window", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const fetch = jest.fn().mockResolvedValue(successResult);

    await executeKSeFSchedule(
      {
        ...baseSchedule,
        lastRunAt: new Date("2026-07-10T22:30:00.000Z"),
      },
      { ...dependencies, fetch }
    );

    expect(fetch).toHaveBeenCalledWith({
      dateFrom: "2026-07-11",
      dateTo: "2026-07-15",
      type: "COST",
    });
  });
});
