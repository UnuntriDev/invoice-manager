const mockDocument = {
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockContractor = {
  findUnique: jest.fn(),
};

const mockCategorizationRule = {
  findMany: jest.fn(),
};

const mockTransaction = jest.fn();
const mockWriteAttachment = jest.fn();
const mockRemoveAttachmentIfExists = jest.fn();
const mockCreateAttachmentLocation = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
  },
}));

jest.mock("@/lib/storage/attachment-storage", () => ({
  createAttachmentLocation: mockCreateAttachmentLocation,
  writeAttachment: mockWriteAttachment,
  removeAttachmentIfExists: mockRemoveAttachmentIfExists,
}));

import { handleUpload } from "@/lib/services/upload.service";

const validPdfData = {
  invoiceNumber: "FV/2026/07/FILE",
  documentTypeId: "cm123456789012345678901234",
  contractorId: "cm223456789012345678901234",
  issueDate: "2026-07-01",
  dueDate: "2026-07-31",
  amountNet: "100.00",
  amountVat: "23.00",
  amountGross: "123.00",
  bankAccountNumber: "",
};

const pdfBytes = Uint8Array.from(Buffer.from("%PDF-1.4\n%%EOF", "ascii"));
const pdfFile = {
  name: "invoice.pdf",
  type: "application/pdf",
  size: pdfBytes.byteLength,
  arrayBuffer: jest.fn().mockResolvedValue(pdfBytes.buffer),
} as unknown as File;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAttachmentLocation.mockReturnValue({
    fileName: "generated.pdf",
    fileKey: "generated.pdf",
  });
  mockWriteAttachment.mockResolvedValue(undefined);
  mockRemoveAttachmentIfExists.mockResolvedValue(true);
  mockDocument.findUnique.mockResolvedValue(null);
  mockContractor.findUnique.mockResolvedValue({ defaultCategoryId: null });
  mockCategorizationRule.findMany.mockResolvedValue([]);
  mockDocument.create.mockResolvedValue({ id: "doc-1" });
  mockTransaction.mockImplementation(
    async (
      callback: (transaction: {
        document: typeof mockDocument;
        contractor: typeof mockContractor;
        categorizationRule: typeof mockCategorizationRule;
      }) => unknown
    ) =>
      callback({
        document: mockDocument,
        contractor: mockContractor,
        categorizationRule: mockCategorizationRule,
      })
  );
});

describe("upload file/database consistency", () => {
  it("does not start a database transaction when writing the file fails", async () => {
    const storageError = new Error("disk full");
    mockWriteAttachment.mockRejectedValue(storageError);

    await expect(handleUpload(pdfFile, validPdfData)).rejects.toBe(storageError);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockDocument.create).not.toHaveBeenCalled();
    expect(mockRemoveAttachmentIfExists).not.toHaveBeenCalled();
  });

  it("removes the written file when creating the database record fails", async () => {
    const databaseError = new Error("database unavailable");
    mockDocument.create.mockRejectedValue(databaseError);

    await expect(handleUpload(pdfFile, validPdfData)).rejects.toBe(databaseError);

    expect(mockWriteAttachment).toHaveBeenCalled();
    expect(mockRemoveAttachmentIfExists).toHaveBeenCalledWith(
      "generated.pdf"
    );
  });

  it("logs a cleanup failure and preserves the original database error", async () => {
    const databaseError = new Error("database unavailable");
    const cleanupError = new Error("file locked");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockDocument.create.mockRejectedValue(databaseError);
    mockRemoveAttachmentIfExists.mockRejectedValue(cleanupError);

    await expect(handleUpload(pdfFile, validPdfData)).rejects.toBe(databaseError);

    expect(errorSpy).toHaveBeenCalledWith(
      "[attachment-cleanup-failed]",
      expect.objectContaining({
        operation: "rollback-upload-after-database-error",
        filePath: "generated.pdf",
      })
    );
    errorSpy.mockRestore();
  });

  it("returns the created document only after both writes succeed", async () => {
    await expect(handleUpload(pdfFile, validPdfData)).resolves.toEqual({
      id: "doc-1",
    });

    expect(mockWriteAttachment).toHaveBeenCalled();
    expect(mockDocument.create).toHaveBeenCalled();
    expect(mockRemoveAttachmentIfExists).not.toHaveBeenCalled();
  });
});
