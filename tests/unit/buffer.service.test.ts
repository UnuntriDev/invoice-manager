const mockQueryRaw = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindMany = jest.fn();
const mockTransaction = jest.fn();

const transactionClient = {
  $queryRawUnsafe: mockQueryRaw,
  document: { updateMany: mockUpdateMany },
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
    document: { findMany: mockFindMany },
  },
}));

import {
  acceptDocuments,
  listBufferDocuments,
} from "@/lib/services/buffer.service";
import { ConflictError } from "@/lib/errors/validation-errors";

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation(async (callback) =>
    callback(transactionClient),
  );
});

it("accepts the complete locked batch atomically", async () => {
  mockQueryRaw.mockResolvedValue([
    { id: "one", status: "BUFFER" },
    { id: "two", status: "BUFFER" },
  ]);
  mockUpdateMany.mockResolvedValue({ count: 2 });

  await expect(acceptDocuments(["one", "two"])).resolves.toBe(2);
  expect(mockUpdateMany).toHaveBeenCalledWith({
    where: { id: { in: ["one", "two"] }, status: "BUFFER" },
    data: { status: "ACCEPTED" },
  });
});

it("returns a stable cursor page without raw XML or storage keys", async () => {
  mockFindMany.mockResolvedValue([{ id: "one" }, { id: "two" }, { id: "three" }]);

  await expect(
    listBufferDocuments({ pageSize: 2, cursor: undefined }),
  ).resolves.toEqual({
    items: [{ id: "one" }, { id: "two" }],
    nextCursor: "two",
  });
  const query = mockFindMany.mock.calls[0][0];
  expect(query).toMatchObject({
    where: { status: "BUFFER" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 3,
  });
  expect(query.select.xmlData).toBeUndefined();
  expect(query.select.fileKey).toBeUndefined();
});

it("rolls back the whole batch when one document is missing", async () => {
  mockQueryRaw.mockResolvedValue([{ id: "one", status: "BUFFER" }]);

  await expect(acceptDocuments(["one", "missing"])).rejects.toBeInstanceOf(
    ConflictError,
  );
  expect(mockUpdateMany).not.toHaveBeenCalled();
});

it("rolls back the whole batch when one document was already accepted", async () => {
  mockQueryRaw.mockResolvedValue([
    { id: "one", status: "BUFFER" },
    { id: "two", status: "ACCEPTED" },
  ]);

  await expect(acceptDocuments(["one", "two"])).rejects.toBeInstanceOf(
    ConflictError,
  );
  expect(mockUpdateMany).not.toHaveBeenCalled();
});
