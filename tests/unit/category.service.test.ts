const mockExecuteRaw = jest.fn();
const mockQueryRaw = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockTransaction = jest.fn();

const transactionClient = {
  $executeRawUnsafe: mockExecuteRaw,
  $queryRawUnsafe: mockQueryRaw,
  category: {
    findUnique: mockFindUnique,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  },
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
    category: { findMany: jest.fn() },
  },
}));

import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/services/category.service";
import { CategoryValidationError } from "@/lib/errors/validation-errors";

beforeEach(() => {
  jest.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(0);
  mockTransaction.mockImplementation(async (callback) =>
    callback(transactionClient),
  );
});

it("rejects a multi-level category cycle", async () => {
  mockFindUnique
    .mockResolvedValueOnce({ name: "A", parentId: null })
    .mockResolvedValueOnce({ parentId: "category-c" })
    .mockResolvedValueOnce({ parentId: "category-a" });

  await expect(
    updateCategory("category-a", { parentId: "category-b" }),
  ).rejects.toBeInstanceOf(CategoryValidationError);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("stores a normalized root scope used by the database unique key", async () => {
  mockCreate.mockResolvedValue({ id: "category-1" });

  await createCategory({ name: "  ŻYWNOŚĆ  ", parentId: null });

  expect(mockCreate).toHaveBeenCalledWith({
    data: {
      name: "ŻYWNOŚĆ",
      nameNormalized: "żywność",
      parentId: null,
      parentScope: "__root__",
    },
  });
});

it("allows only one of two concurrent sibling creates", async () => {
  let inserted = false;
  mockCreate.mockImplementation(async () => {
    await Promise.resolve();
    if (inserted) {
      throw Object.assign(new Error("unique conflict"), { code: "P2002" });
    }
    inserted = true;
    return { id: "category-1" };
  });

  const results = await Promise.allSettled([
    createCategory({ name: "Transport", parentId: null }),
    createCategory({ name: "Transport", parentId: null }),
  ]);

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
    1,
  );
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
});

it("marks deletion of a missing category as not found", async () => {
  mockQueryRaw.mockResolvedValue([]);

  await expect(deleteCategory("category-missing")).rejects.toMatchObject({
    code: "P2025",
  });
  expect(mockDelete).not.toHaveBeenCalled();
});

it("locks and validates a category before deleting it", async () => {
  mockQueryRaw.mockResolvedValue([{ id: "category-1" }]);
  mockFindUnique.mockResolvedValue({
    id: "category-1",
    _count: { children: 0, documents: 0 },
  });
  mockDelete.mockResolvedValue({ id: "category-1" });

  await deleteCategory("category-1");

  expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  expect(mockQueryRaw).toHaveBeenCalledWith(
    expect.stringContaining("FOR UPDATE"),
    "category-1",
  );
  expect(mockDelete).toHaveBeenCalledWith({ where: { id: "category-1" } });
});
