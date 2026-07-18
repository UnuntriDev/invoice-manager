const mockTransaction = jest.fn();
const mockTaskDeleteMany = jest.fn();
const mockTaskFindUnique = jest.fn();
const mockTaskUpdateMany = jest.fn();
const mockRemoveAttachmentIfExists = jest.fn();
const mockReconcileAttachmentStorage = jest.fn();
const mockLogAttachmentCleanupError = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
    document: { findMany: jest.fn() },
    attachmentCleanupTask: {
      findMany: jest.fn(),
      deleteMany: mockTaskDeleteMany,
      findUnique: mockTaskFindUnique,
      updateMany: mockTaskUpdateMany,
    },
  },
}));
jest.mock("@/lib/storage/attachment-storage", () => ({
  removeAttachmentIfExists: mockRemoveAttachmentIfExists,
  reconcileAttachmentStorage: mockReconcileAttachmentStorage,
}));
jest.mock("@/lib/storage/attachment-logger", () => ({
  logAttachmentCleanupError: mockLogAttachmentCleanupError,
}));

import {
  processAttachmentCleanupTask,
  reconcileOrphanedAttachments,
} from "@/lib/services/attachment-reconciliation.service";

beforeEach(() => {
  jest.clearAllMocks();
  mockTaskDeleteMany.mockResolvedValue({ count: 1 });
  mockRemoveAttachmentIfExists.mockResolvedValue(true);
  mockReconcileAttachmentStorage.mockResolvedValue({
    deletedOrphans: [],
    errors: [],
  });
});

describe("attachment reconciliation", () => {
  it("does not touch storage when database references cannot be loaded", async () => {
    const databaseError = new Error("database unavailable");
    mockTransaction.mockRejectedValue(databaseError);

    await expect(reconcileOrphanedAttachments()).rejects.toBe(databaseError);
    expect(mockReconcileAttachmentStorage).not.toHaveBeenCalled();
    expect(mockRemoveAttachmentIfExists).not.toHaveBeenCalled();
  });

  it("retries a durable cleanup task after a restart", async () => {
    const cleanupError = new Error("file locked");
    mockRemoveAttachmentIfExists
      .mockRejectedValueOnce(cleanupError)
      .mockResolvedValueOnce(false);
    mockTaskFindUnique.mockResolvedValue({ attempts: 0 });
    mockTaskUpdateMany.mockResolvedValue({ count: 1 });

    await expect(processAttachmentCleanupTask("invoice.pdf")).resolves.toBe(
      false,
    );
    expect(mockTaskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fileKey: "invoice.pdf" },
        data: expect.objectContaining({ attempts: 1, lastError: "file locked" }),
      }),
    );

    await expect(processAttachmentCleanupTask("invoice.pdf")).resolves.toBe(
      true,
    );
    expect(mockTaskDeleteMany).toHaveBeenCalledWith({
      where: { fileKey: "invoice.pdf" },
    });
  });

  it("does not fail a committed deletion when cleanup state persistence is temporarily unavailable", async () => {
    const storageError = new Error("storage unavailable");
    const databaseError = new Error("database unavailable");
    mockRemoveAttachmentIfExists.mockRejectedValue(storageError);
    mockTaskFindUnique.mockRejectedValue(databaseError);

    await expect(processAttachmentCleanupTask("invoice.pdf")).resolves.toBe(
      false,
    );
    expect(mockLogAttachmentCleanupError).toHaveBeenNthCalledWith(
      1,
      "retryable-document-attachment-delete",
      "invoice.pdf",
      storageError,
    );
    expect(mockLogAttachmentCleanupError).toHaveBeenNthCalledWith(
      2,
      "retryable-document-attachment-delete-state",
      "invoice.pdf",
      databaseError,
    );
  });

  it("processes tombstones before scanning ordinary orphans", async () => {
    mockTransaction.mockResolvedValue([
      [{ fileKey: "referenced.pdf" }],
      [{ fileKey: "pending-delete.pdf" }],
    ]);

    await reconcileOrphanedAttachments();

    expect(mockRemoveAttachmentIfExists).toHaveBeenCalledWith(
      "pending-delete.pdf",
    );
    expect(mockReconcileAttachmentStorage).toHaveBeenCalledWith([
      "referenced.pdf",
      "pending-delete.pdf",
    ]);
  });
});
