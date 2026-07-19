import { readFileSync } from "fs";
import path from "path";

const mockDocument = {
  findUnique: jest.fn(),
  create: jest.fn(),
};
const mockContractor = { upsert: jest.fn() };
const mockDocumentType = { findFirst: jest.fn() };
const mockCategorizationRule = { findMany: jest.fn() };
const mockTransaction = jest.fn();
const mockWriteAttachment = jest.fn();
const mockRemoveAttachmentIfExists = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: { $transaction: mockTransaction },
}));
jest.mock("@/lib/storage/attachment-storage", () => ({
  createAttachmentLocation: jest.fn(() => ({
    fileName: "generated.xml",
    fileKey: "generated.xml",
  })),
  writeAttachment: mockWriteAttachment,
  removeAttachmentIfExists: mockRemoveAttachmentIfExists,
}));

import { handleUpload } from "@/lib/services/upload.service";

const costFa3 = readFileSync(
  path.join(__dirname, "../../docs/sample-fa3.xml"),
  "utf8",
);
const salesFa3 = readFileSync(
  path.join(__dirname, "../../docs/sample-fa3-sales.xml"),
  "utf8",
);

function asFa2(xml: string) {
  return xml
    .replace("FA (3)", "FA (2)")
    .replace("<WariantFormularza>3", "<WariantFormularza>2")
    .replace("2023/06/29/12648", "2022/05/05/10591");
}

function xmlFile(xml: string): File {
  const bytes = Uint8Array.from(Buffer.from(xml, "utf8"));
  return {
    name: "invoice.xml",
    type: "application/xml",
    size: bytes.byteLength,
    arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
  } as unknown as File;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.COMPANY_NIP = "9876543210";
  mockWriteAttachment.mockResolvedValue(undefined);
  mockRemoveAttachmentIfExists.mockResolvedValue(true);
  mockDocument.findUnique.mockResolvedValue(null);
  mockDocument.create.mockResolvedValue({ id: "document-1" });
  mockContractor.upsert.mockImplementation(
    async () => ({
      id: "cm22345678901234567890123",
      name: "Kontrahent",
      defaultCategoryId: null,
    }),
  );
  mockDocumentType.findFirst.mockImplementation(
    async () => ({
      id: "cm12345678901234567890123",
    }),
  );
  mockCategorizationRule.findMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(
    async (
      callback: (transaction: {
        document: typeof mockDocument;
        contractor: typeof mockContractor;
        documentType: typeof mockDocumentType;
        categorizationRule: typeof mockCategorizationRule;
      }) => unknown,
    ) =>
      callback({
        document: mockDocument,
        contractor: mockContractor,
        documentType: mockDocumentType,
        categorizationRule: mockCategorizationRule,
      }),
  );
});

describe.each([
  ["FA(2)", asFa2(costFa3), asFa2(salesFa3)],
  ["FA(3)", costFa3, salesFa3],
])("XML upload direction for %s", (_variant, costXml, salesXml) => {
  it("uses the seller as contractor for a cost invoice", async () => {
    await handleUpload(xmlFile(costXml));

    expect(mockContractor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nip: "5213000009" } }),
    );
    expect(mockDocumentType.findFirst).toHaveBeenCalledWith({
      where: { direction: "PAYABLE", isSystem: true },
    });
  });

  it("uses the buyer as contractor for a sales invoice", async () => {
    await handleUpload(xmlFile(salesXml));

    expect(mockContractor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nip: "6762464586" } }),
    );
    expect(mockDocumentType.findFirst).toHaveBeenCalledWith({
      where: { direction: "RECEIVABLE", isSystem: true },
    });
  });
});

it("rejects XML when COMPANY_NIP is absent", async () => {
  delete process.env.COMPANY_NIP;

  await expect(handleUpload(xmlFile(costFa3))).rejects.toThrow("COMPANY_NIP");
  expect(mockTransaction).not.toHaveBeenCalled();
  expect(mockWriteAttachment).not.toHaveBeenCalled();
});
