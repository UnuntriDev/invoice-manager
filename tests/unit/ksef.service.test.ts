import type {
  IKSeFClient,
  KSeFInvoice,
} from "@/lib/ksef/ksef-client.interface";

const mockDocumentTypeFindFirst = jest.fn();
const mockContractorUpsert = jest.fn();
const mockDocumentCreateMany = jest.fn();

const mockTransactionClient = {
  documentType: { findFirst: mockDocumentTypeFindFirst },
  contractor: { upsert: mockContractorUpsert },
  document: { createMany: mockDocumentCreateMany },
};

const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
  },
}));

import {
  fetchFromKSeF,
  importKSeFBatch,
} from "@/lib/services/ksef.service";

const params = {
  dateFrom: "2026-07-01",
  dateTo: "2026-07-31",
  type: "COST" as const,
};

function invoice(overrides: Partial<KSeFInvoice> = {}): KSeFInvoice {
  return {
    ksefNumber: "1234567890-01-100001",
    invoiceNumber: "FV/2026/07/001",
    issueDate: "2026-07-10",
    saleDate: "2026-07-10",
    dueDate: "2026-08-09",
    currency: "PLN",
    seller: {
      nip: "5213000009",
      name: "PackPol Sp. z o.o.",
      address: "Warszawa",
    },
    buyer: {
      nip: "9876543210",
      name: "Gumijagoda Sp. z o.o.",
      address: "Zakopane",
    },
    lineItems: [
      {
        lineNumber: 1,
        description: "Opakowania",
        unit: "szt",
        quantity: 10,
        unitPriceNet: "100.00",
        amountNet: "1000.00",
        vatRate: 23,
      },
    ],
    amountNet: "1000.00",
    amountVat: "230.00",
    amountGross: "1230.00",
    xmlContent: "<Faktura />",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockDocumentTypeFindFirst.mockResolvedValue({ id: "cost-type" });
  mockContractorUpsert.mockImplementation(
    async ({ where }: { where: { nip: string } }) => ({
      id: `contractor-${where.nip}`,
      defaultCategoryId: null,
    })
  );
  mockDocumentCreateMany.mockImplementation(
    async ({ data }: { data: unknown[] }) => ({ count: data.length })
  );
  mockTransaction.mockImplementation(
    async (
      callback: (tx: typeof mockTransactionClient) => Promise<unknown>
    ) => callback(mockTransactionClient)
  );
});

describe("importKSeFBatch", () => {
  it("imports the complete batch in one transaction", async () => {
    const batch = [
      invoice(),
      invoice({
        ksefNumber: "1234567890-01-100002",
        invoiceNumber: "FV/2026/07/002",
        seller: { nip: "5261040828", name: "CukroPol S.A." },
      }),
    ];

    const result = await importKSeFBatch(batch, params);

    expect(result).toEqual({
      success: true,
      total: 2,
      imported: 2,
      skipped: 0,
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDocumentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ ksefNumber: "1234567890-01-100001" }),
          expect.objectContaining({ ksefNumber: "1234567890-01-100002" }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it("rolls back staged writes when one batch element causes a database error", async () => {
    const committedContractors: string[] = [];
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    mockTransaction.mockImplementation(
      async (
        callback: (tx: typeof mockTransactionClient) => Promise<unknown>
      ) => {
        const stagedContractors: string[] = [];
        mockContractorUpsert.mockImplementation(
          async ({ where }: { where: { nip: string } }) => {
            stagedContractors.push(where.nip);
            return {
              id: `contractor-${where.nip}`,
              defaultCategoryId: null,
            };
          }
        );
        mockDocumentCreateMany.mockImplementation(
          async ({ data }: { data: Array<{ ksefNumber: string }> }) => {
            for (const row of data) {
              if (row.ksefNumber === "KSEF-FAIL") {
                throw new Error("database rejected one element");
              }
            }
            return { count: data.length };
          }
        );

        const result = await callback(mockTransactionClient);
        committedContractors.push(...stagedContractors);
        return result;
      }
    );

    const result = await importKSeFBatch(
      [
        invoice(),
        invoice({
          ksefNumber: "KSEF-FAIL",
          invoiceNumber: "FV/2026/07/002",
          seller: { nip: "5261040828", name: "CukroPol S.A." },
        }),
      ],
      params
    );

    expect(result).toEqual({
      success: false,
      error:
        "Nie udało się zapisać dokumentów z KSeF. Żadne dane nie zostały zapisane.",
    });
    expect(committedContractors).toEqual([]);
    consoleError.mockRestore();
  });

  it("is idempotent when the same documents are imported again", async () => {
    const persistedKeys = new Set<string>();
    mockDocumentCreateMany.mockImplementation(
      async (
        { data }: { data: Array<{ ksefNumber: string; invoiceNumber: string }> }
      ) => {
        let count = 0;
        for (const row of data) {
          const key = `${row.ksefNumber}:${row.invoiceNumber}`;
          if (!persistedKeys.has(key)) {
            persistedKeys.add(key);
            count++;
          }
        }
        return { count };
      }
    );

    const batch = [invoice()];
    const first = await importKSeFBatch(batch, params);
    const second = await importKSeFBatch(batch, params);

    expect(first).toEqual({
      success: true,
      total: 1,
      imported: 1,
      skipped: 0,
    });
    expect(second).toEqual({
      success: true,
      total: 1,
      imported: 0,
      skipped: 1,
    });
  });

  it("keeps concurrent imports free of duplicate documents", async () => {
    const persistedKsefNumbers = new Set<string>();
    mockDocumentCreateMany.mockImplementation(
      async ({ data }: { data: Array<{ ksefNumber: string }> }) => {
        await Promise.resolve();
        let count = 0;
        for (const row of data) {
          if (!persistedKsefNumbers.has(row.ksefNumber)) {
            persistedKsefNumbers.add(row.ksefNumber);
            count += 1;
          }
        }
        return { count };
      },
    );

    const [first, second] = await Promise.all([
      importKSeFBatch([invoice()], params),
      importKSeFBatch([invoice()], params),
    ]);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(
      [first, second].reduce(
        (sum, result) => sum + (result.success ? result.imported : 0),
        0,
      ),
    ).toBe(1);
    expect(persistedKsefNumbers.size).toBe(1);
  });

  it("skips duplicates inside one batch before creating related records", async () => {
    const duplicateKsefNumber = invoice({ invoiceNumber: "IGNORED-KSEF-DUPLICATE" });
    const duplicateBusinessKey = invoice({
      ksefNumber: "1234567890-01-999999",
    });

    const result = await importKSeFBatch(
      [invoice(), duplicateKsefNumber, duplicateBusinessKey],
      params
    );

    expect(result).toEqual({
      success: true,
      total: 3,
      imported: 1,
      skipped: 2,
    });
    expect(mockContractorUpsert).toHaveBeenCalledTimes(1);
    expect(mockDocumentCreateMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("rejects invalid invoice data before opening a transaction", async () => {
    const invalidInvoice = invoice({ ksefNumber: "" });

    const result = await importKSeFBatch([invalidInvoice], params);

    expect(result).toEqual({
      success: false,
      error: "KSeF zwrócił nieprawidłowe dane: Numer KSeF jest wymagany",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("fetchFromKSeF", () => {
  it("returns the required error shape when the KSeF client fails", async () => {
    const client: IKSeFClient = {
      authenticate: jest.fn(),
      isAuthenticated: jest.fn(() => false),
      fetchInvoices: jest.fn().mockRejectedValue(new Error("network unavailable")),
    };
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await fetchFromKSeF(params, client);

    expect(result).toEqual({
      success: false,
      error: "Nie udało się połączyć z KSeF. Spróbuj ponownie.",
    });
    consoleError.mockRestore();
  });
});
