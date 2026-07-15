const mockFindMany = jest.fn();
const mockReconcileAttachmentStorage = jest.fn();
const mockLogAttachmentCleanupError = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    document: { findMany: mockFindMany },
  },
}));

jest.mock("@/lib/storage/attachment-storage", () => ({
  reconcileAttachmentStorage: mockReconcileAttachmentStorage,
}));

jest.mock("@/lib/storage/attachment-logger", () => ({
  logAttachmentCleanupError: mockLogAttachmentCleanupError,
}));

import { reconcileOrphanedAttachments } from "@/lib/services/attachment-reconciliation.service";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("attachment reconciliation", () => {
  it("does not touch storage when database references cannot be loaded", async () => {
    const databaseError = new Error("database unavailable");
    mockFindMany.mockRejectedValue(databaseError);

    await expect(reconcileOrphanedAttachments()).rejects.toBe(databaseError);

    expect(mockReconcileAttachmentStorage).not.toHaveBeenCalled();
  });

  it("passes all referenced files to storage and logs cleanup failures", async () => {
    const cleanupError = new Error("file locked");
    mockFindMany.mockResolvedValue([
      { filePath: "C:\\uploads\\one.pdf" },
      { filePath: "C:\\uploads\\two.xml" },
    ]);
    mockReconcileAttachmentStorage.mockResolvedValue({
      deletedOrphans: [],
      restoredStaged: [],
      deletedStaged: [],
      errors: [
        { filePath: "C:\\uploads\\orphan.pdf", error: cleanupError },
      ],
    });

    await reconcileOrphanedAttachments();

    expect(mockReconcileAttachmentStorage).toHaveBeenCalledWith([
      "C:\\uploads\\one.pdf",
      "C:\\uploads\\two.xml",
    ]);
    expect(mockLogAttachmentCleanupError).toHaveBeenCalledWith(
      "scheduled-orphan-reconciliation",
      "C:\\uploads\\orphan.pdf",
      cleanupError
    );
  });
});
