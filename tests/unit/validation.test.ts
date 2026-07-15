import {
  contractorCreateSchema,
  documentCreateSchema,
  documentListQuerySchema,
  documentUpdateSchema,
  moneySchema,
  pdfUploadSchema,
} from "@/lib/validators/schemas";
import { addMoney, formatCurrency } from "@/lib/money";
import { formatDocumentDate, formatDocumentDateTime } from "@/lib/dates";
import {
  getUploadFileValidationError,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/validators/upload";

const validDocument = {
  invoiceNumber: "FV/2026/07/001",
  documentTypeId: "cm123456789012345678901234",
  contractorId: "cm223456789012345678901234",
  issueDate: "2026-07-01",
  dueDate: "2026-07-31",
  amountNet: "0.10",
  amountVat: "0.20",
  amountGross: "0.30",
  bankAccountNumber: "61 1090 1014 0000 0712 1981 2874",
  categoryId: null,
  source: "MANUAL" as const,
  status: "ACCEPTED" as const,
};

describe("money validation and arithmetic", () => {
  it("calculates decimal amounts without floating-point errors", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(formatCurrency("1234567.80")).toBe("1 234 567,80 zł");
  });

  it("normalizes a valid amount to two decimal places", () => {
    expect(moneySchema.parse("12,5")).toBe("12.50");
  });

  it.each([
    ["negative", "-0.01"],
    ["too many decimal places", "1.001"],
    ["exponential notation", "1e3"],
    ["above Decimal(12,2)", "10000000000.00"],
  ])("rejects %s amounts", (_name, value) => {
    expect(moneySchema.safeParse(value).success).toBe(false);
  });

  it("rejects JavaScript numbers at the API boundary", () => {
    expect(moneySchema.safeParse(0.1).success).toBe(false);
  });
});

describe("central document schemas", () => {
  it("accepts and normalizes a valid create payload", () => {
    const result = documentCreateSchema.parse(validDocument);

    expect(result.amountGross).toBe("0.30");
    expect(result.bankAccountNumber).toBe("61109010140000071219812874");
  });

  it("rejects a non-existent ISO calendar date", () => {
    const result = documentCreateSchema.safeParse({
      ...validDocument,
      issueDate: "2026-02-30",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = documentCreateSchema.safeParse({
      ...validDocument,
      dueDate: "2026-06-30",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid gross amount", () => {
    const result = documentCreateSchema.safeParse({
      ...validDocument,
      amountGross: "0.31",
    });

    expect(result.success).toBe(false);
  });

  it("enforces the same required fields during editing", () => {
    const incomplete: Record<string, unknown> = { ...validDocument };
    delete incomplete.dueDate;
    delete incomplete.source;
    delete incomplete.status;

    expect(documentUpdateSchema.safeParse(incomplete).success).toBe(false);
  });

  it("uses the same financial and date rules for PDF upload", () => {
    const result = pdfUploadSchema.safeParse({
      ...validDocument,
      amountGross: "0.30000000000000004",
    });

    expect(result.success).toBe(false);
  });
});

describe("document registry query validation", () => {
  it("formats ISO database dates as date-only values", () => {
    expect(formatDocumentDate("2026-07-01T00:00:00.000Z")).toBe(
      "01.07.2026"
    );
  });

  it("does not render invalid dates", () => {
    expect(formatDocumentDate("2026-02-30T00:00:00.000Z")).toBe("—");
    expect(formatDocumentDate("not-a-date")).toBe("—");
    expect(formatDocumentDateTime("not-a-date")).toBe("—");
  });

  it("does not allow a client to request BUFFER documents", () => {
    expect(
      documentListQuerySchema.safeParse({ status: "BUFFER" }).success
    ).toBe(false);
  });

  it("rejects reversed date ranges and oversized pages", () => {
    expect(
      documentListQuerySchema.safeParse({
        dateFrom: "2026-07-31",
        dateTo: "2026-07-01",
      }).success
    ).toBe(false);
    expect(
      documentListQuerySchema.safeParse({ pageSize: "101" }).success
    ).toBe(false);
  });
});

describe("contractor validation", () => {
  it("rejects an account with an invalid IBAN checksum", () => {
    const result = contractorCreateSchema.safeParse({
      name: "Testowy kontrahent",
      nip: "5213000000",
      bankAccountNumber: "61109010140000071219812875",
      defaultCategoryId: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a NIP with an invalid checksum", () => {
    const result = contractorCreateSchema.safeParse({
      name: "Testowy kontrahent",
      nip: "5213000001",
      bankAccountNumber: "",
      defaultCategoryId: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("upload file validation", () => {
  it("rejects a file larger than 10MB", () => {
    expect(
      getUploadFileValidationError({
        size: MAX_UPLOAD_SIZE_BYTES + 1,
        type: "application/pdf",
      })
    ).toContain("za duży");
  });

  it("rejects an unsupported MIME type", () => {
    expect(
      getUploadFileValidationError({ size: 100, type: "image/png" })
    ).toBe("Dozwolone formaty to PDF i XML");
  });
});
