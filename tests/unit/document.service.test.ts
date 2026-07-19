const mockDocument = {
  findMany: jest.fn(),
  count: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  updateMany: jest.fn(),
};

const mockContractor = {
  findUnique: jest.fn(),
};

const mockCategorizationRule = {
  findMany: jest.fn(),
};

const mockAttachmentCleanupTask = {
  upsert: jest.fn(),
};
const mockTransaction = jest.fn();
const mockProcessAttachmentCleanupTask = jest.fn();

jest.mock("@/lib/services/attachment-reconciliation.service", () => ({
  processAttachmentCleanupTask: mockProcessAttachmentCleanupTask,
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    document: mockDocument,
    contractor: mockContractor,
    categorizationRule: mockCategorizationRule,
    $transaction: mockTransaction,
  },
}));

import {
  createDocument,
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
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCategorizationRule.findMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(
    async (
      callback: (transaction: {
        document: typeof mockDocument;
        attachmentCleanupTask: typeof mockAttachmentCleanupTask;
      }) => unknown,
    ) =>
      callback({
        document: mockDocument,
        attachmentCleanupTask: mockAttachmentCleanupTask,
      }),
  );
  mockAttachmentCleanupTask.upsert.mockResolvedValue({ id: "cleanup-1" });
  mockProcessAttachmentCleanupTask.mockResolvedValue(true);
  mockDocument.count.mockResolvedValue(0);
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
    mockDocument.count.mockResolvedValue(42);

    const result = await listAcceptedDocuments(
      documentListQuerySchema.parse({ pageSize: "2" })
    );

    expect(mockDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        take: 3,
      })
    );
    expect(mockDocument.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
    expect(result).toEqual({
      items: [{ id: "doc-1" }, { id: "doc-2" }],
      nextCursor: "doc-2",
      total: 42,
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
    expect(mockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "MANUAL",
          status: "ACCEPTED",
          ksefNumber: null,
        }),
      }),
    );
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

describe("deleteDocument", () => {
  it("commits a durable cleanup task before touching storage", async () => {
    mockDocument.findUnique.mockResolvedValue({ fileKey: "invoice.pdf" });
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });
    mockTransaction.mockImplementationOnce(async (callback) => {
      const result = await callback({
        document: mockDocument,
        attachmentCleanupTask: mockAttachmentCleanupTask,
      });
      expect(mockAttachmentCleanupTask.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fileKey: "invoice.pdf" },
          create: { fileKey: "invoice.pdf" },
        }),
      );
      expect(mockProcessAttachmentCleanupTask).not.toHaveBeenCalled();
      return result;
    });

    await expect(deleteDocument("doc-1")).resolves.toEqual({ id: "doc-1" });

    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(mockProcessAttachmentCleanupTask).toHaveBeenCalledWith("invoice.pdf");
  });

  it("does not touch storage when the database transaction fails", async () => {
    const databaseError = new Error("database unavailable");
    mockDocument.findUnique.mockResolvedValue({ fileKey: "invoice.pdf" });
    mockDocument.delete.mockRejectedValue(databaseError);

    await expect(deleteDocument("doc-1")).rejects.toBe(databaseError);
    expect(mockProcessAttachmentCleanupTask).not.toHaveBeenCalled();
  });

  it("keeps a committed delete when immediate cleanup is deferred", async () => {
    mockDocument.findUnique.mockResolvedValue({ fileKey: "invoice.pdf" });
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });
    mockProcessAttachmentCleanupTask.mockResolvedValue(false);

    await expect(deleteDocument("doc-1")).resolves.toEqual({ id: "doc-1" });
    expect(mockAttachmentCleanupTask.upsert).toHaveBeenCalled();
  });

  it("deletes a document without an attachment without creating a task", async () => {
    mockDocument.findUnique.mockResolvedValue({ fileKey: null });
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });

    await expect(deleteDocument("doc-1")).resolves.toEqual({ id: "doc-1" });

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(mockAttachmentCleanupTask.upsert).not.toHaveBeenCalled();
    expect(mockProcessAttachmentCleanupTask).not.toHaveBeenCalled();
  });
});
