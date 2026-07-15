const mockDocument = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  updateMany: jest.fn(),
};

const mockContractor = {
  findUnique: jest.fn(),
};

const mockTransaction = jest.fn();
const mockStageAttachmentForDeletion = jest.fn();
const mockRestoreStagedAttachment = jest.fn();
const mockFinalizeStagedAttachment = jest.fn();
const mockReadAttachment = jest.fn();
const mockWriteAttachment = jest.fn();

jest.mock("@/lib/storage/attachment-storage", () => ({
  stageAttachmentForDeletion: mockStageAttachmentForDeletion,
  restoreStagedAttachment: mockRestoreStagedAttachment,
  finalizeStagedAttachment: mockFinalizeStagedAttachment,
  readAttachment: mockReadAttachment,
  writeAttachment: mockWriteAttachment,
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    document: mockDocument,
    contractor: mockContractor,
    $transaction: mockTransaction,
  },
}));

import {
  createDocument,
  acceptDocuments,
  DuplicateError,
  deleteDocument,
  listAcceptedDocuments,
} from "@/lib/services/document.service";
import { documentListQuerySchema } from "@/lib/validators/schemas";

const baseDocData = {
  invoiceNumber: "FV/2026/01/001",
  documentTypeId: "doctype-1",
  contractorId: "contractor-1",
  issueDate: "2026-01-15",
  dueDate: "2026-02-15",
  amountNet: "1000.00",
  amountVat: "230.00",
  amountGross: "1230.00",
  bankAccountNumber: "",
  source: "MANUAL" as const,
  status: "ACCEPTED" as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(
    async (callback: (transaction: { document: typeof mockDocument }) => unknown) =>
      callback({ document: mockDocument })
  );
  mockReadAttachment.mockResolvedValue(Buffer.from("attachment"));
  mockWriteAttachment.mockResolvedValue(undefined);
});

describe("listAcceptedDocuments", () => {
  it("filters out non-accepted documents in the database query", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "accepted-1", status: "ACCEPTED" },
    ]);

    const result = await listAcceptedDocuments(
      documentListQuerySchema.parse({})
    );

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
    expect(result.items).toEqual([
      { id: "accepted-1", status: "ACCEPTED" },
    ]);
  });

  it("uses a stable cursor and returns only the requested page", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "doc-1" },
      { id: "doc-2" },
      { id: "doc-3" },
    ]);

    const result = await listAcceptedDocuments(
      documentListQuerySchema.parse({ pageSize: "2" })
    );

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        take: 3,
      })
    );
    expect(result).toEqual({
      items: [{ id: "doc-1" }, { id: "doc-2" }],
      nextCursor: "doc-2",
    });
  });

  it("applies date filters and the supplied cursor to the database query", async () => {
    mockDocument.findMany.mockResolvedValue([]);
    const cursor = "cm323456789012345678901234";

    await listAcceptedDocuments(
      documentListQuerySchema.parse({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        cursor,
        sortBy: "dueDate",
        sortOrder: "asc",
      })
    );

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACCEPTED",
          issueDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-31T00:00:00.000Z"),
          },
        }),
        cursor: { id: cursor },
        skip: 1,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      })
    );
  });

  it("combines registry filters without weakening the accepted status", async () => {
    mockDocument.findMany.mockResolvedValue([]);
    const documentTypeId = "cm423456789012345678901234";
    const contractorId = "cm523456789012345678901234";
    const categoryId = "cm623456789012345678901234";

    await listAcceptedDocuments(
      documentListQuerySchema.parse({
        documentTypeId,
        contractorId,
        categoryId,
        source: "KSEF",
        dueDateFrom: "2026-08-01",
        dueDateTo: "2026-08-31",
        search: "  FV/2026  ",
      })
    );

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "ACCEPTED",
          documentTypeId,
          contractorId,
          categoryId,
          source: "KSEF",
          dueDate: {
            gte: new Date("2026-08-01T00:00:00.000Z"),
            lte: new Date("2026-08-31T00:00:00.000Z"),
          },
          OR: [
            {
              invoiceNumber: {
                contains: "FV/2026",
                mode: "insensitive",
              },
            },
            {
              contractor: {
                name: { contains: "FV/2026", mode: "insensitive" },
              },
            },
          ],
        },
      })
    );
  });
});

describe("createDocument", () => {
  it("creates document when no duplicate exists", async () => {
    mockDocument.findUnique.mockResolvedValue(null);
    mockContractor.findUnique.mockResolvedValue(null);
    mockDocument.create.mockResolvedValue({ id: "doc-1", ...baseDocData });

    const result = await createDocument(baseDocData);

    expect(mockDocument.findUnique).toHaveBeenCalledWith({
      where: {
        unique_invoice: {
          invoiceNumber: "FV/2026/01/001",
          contractorId: "contractor-1",
        },
      },
    });
    expect(result.id).toBe("doc-1");
  });

  it("throws DuplicateError when document already exists", async () => {
    mockDocument.findUnique.mockResolvedValue({ id: "existing-doc" });

    await expect(createDocument(baseDocData)).rejects.toThrow(DuplicateError);
    await expect(createDocument(baseDocData)).rejects.toThrow("już istnieje");
    expect(mockDocument.create).not.toHaveBeenCalled();
  });

  it("auto-assigns category from contractor.defaultCategoryId", async () => {
    const dataWithoutCategory = { ...baseDocData, categoryId: undefined };

    mockDocument.findUnique.mockResolvedValue(null);
    mockContractor.findUnique.mockResolvedValue({
      defaultCategoryId: "cat-auto",
    });
    mockDocument.create.mockResolvedValue({ id: "doc-2" });

    await createDocument(dataWithoutCategory);

    expect(mockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: "cat-auto" }),
      })
    );
  });

  it("does not override manually assigned category", async () => {
    const dataWithCategory = { ...baseDocData, categoryId: "cat-manual" };

    mockDocument.findUnique.mockResolvedValue(null);
    mockDocument.create.mockResolvedValue({ id: "doc-3" });

    await createDocument(dataWithCategory);

    expect(mockContractor.findUnique).not.toHaveBeenCalled();
    expect(mockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: "cat-manual" }),
      })
    );
  });
});

describe("acceptDocuments", () => {
  it("updates documents from BUFFER to ACCEPTED", async () => {
    mockDocument.updateMany.mockResolvedValue({ count: 3 });

    const count = await acceptDocuments(["id-1", "id-2", "id-3"]);

    expect(count).toBe(3);
    expect(mockDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["id-1", "id-2", "id-3"] },
        status: "BUFFER",
      },
      data: { status: "ACCEPTED" },
    });
  });

  it("returns 0 when no documents match", async () => {
    mockDocument.updateMany.mockResolvedValue({ count: 0 });

    const count = await acceptDocuments(["nonexistent"]);

    expect(count).toBe(0);
  });
});

describe("deleteDocument", () => {
  const stagedAttachment = {
    originalPath: "C:\\uploads\\invoice.pdf",
    stagedPath: "C:\\uploads\\.trash\\invoice.pdf",
  };

  it("deletes the attachment and database record as one coordinated operation", async () => {
    mockDocument.findUnique.mockResolvedValue({
      filePath: stagedAttachment.originalPath,
    });
    mockStageAttachmentForDeletion.mockResolvedValue(stagedAttachment);
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });
    mockFinalizeStagedAttachment.mockResolvedValue(undefined);

    await expect(deleteDocument("doc-1")).resolves.toEqual({ id: "doc-1" });

    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(mockFinalizeStagedAttachment).toHaveBeenCalledWith(stagedAttachment);
    expect(mockRestoreStagedAttachment).not.toHaveBeenCalled();
  });

  it("restores the staged file when deleting the database record fails", async () => {
    const databaseError = new Error("database unavailable");
    mockDocument.findUnique.mockResolvedValue({
      filePath: stagedAttachment.originalPath,
    });
    mockStageAttachmentForDeletion.mockResolvedValue(stagedAttachment);
    mockDocument.delete.mockRejectedValue(databaseError);

    await expect(deleteDocument("doc-1")).rejects.toBe(databaseError);

    expect(mockFinalizeStagedAttachment).not.toHaveBeenCalled();
    expect(mockRestoreStagedAttachment).toHaveBeenCalledWith(stagedAttachment);
  });

  it("recreates the original attachment from memory when a staged restore is impossible", async () => {
    const databaseError = new Error("commit failed");
    mockDocument.findUnique.mockResolvedValue({
      filePath: stagedAttachment.originalPath,
    });
    mockStageAttachmentForDeletion.mockResolvedValue(stagedAttachment);
    mockDocument.delete.mockRejectedValue(databaseError);
    mockRestoreStagedAttachment.mockRejectedValue(
      Object.assign(new Error("staged file missing"), { code: "ENOENT" })
    );
    mockReadAttachment
      .mockResolvedValueOnce(Buffer.from("attachment"))
      .mockResolvedValueOnce(null);

    await expect(deleteDocument("doc-1")).rejects.toBe(databaseError);

    expect(mockWriteAttachment).toHaveBeenCalledWith(
      stagedAttachment.originalPath,
      Buffer.from("attachment")
    );
  });

  it("rolls back the database operation and restores the file when final cleanup fails", async () => {
    const cleanupError = new Error("filesystem unavailable");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockDocument.findUnique.mockResolvedValue({
      filePath: stagedAttachment.originalPath,
    });
    mockStageAttachmentForDeletion.mockResolvedValue(stagedAttachment);
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });
    mockFinalizeStagedAttachment.mockRejectedValue(cleanupError);

    await expect(deleteDocument("doc-1")).rejects.toBe(cleanupError);

    expect(mockRestoreStagedAttachment).toHaveBeenCalledWith(stagedAttachment);
    expect(errorSpy).toHaveBeenCalledWith(
      "[attachment-cleanup-failed]",
      expect.objectContaining({
        operation: "finalize-document-attachment-delete",
      })
    );
    errorSpy.mockRestore();
  });

  it("deletes a stale database record when its attachment is already missing", async () => {
    const warningSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockDocument.findUnique.mockResolvedValue({
      filePath: stagedAttachment.originalPath,
    });
    mockStageAttachmentForDeletion.mockResolvedValue(null);
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });

    await expect(deleteDocument("doc-1")).resolves.toEqual({ id: "doc-1" });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(warningSpy).toHaveBeenCalledWith(
      "[attachment-missing]",
      expect.objectContaining({ documentId: "doc-1" })
    );
    warningSpy.mockRestore();
  });
});
