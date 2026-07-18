import prisma from "@/lib/prisma";
import type { CategoryCreate } from "@/lib/validators/schemas";
import { CategoryValidationError } from "@/lib/errors/validation-errors";
import type { Prisma } from "@/generated/prisma/client";
import {
  getCategoryParentScope,
  normalizeCategoryName,
} from "@/lib/category-key";

export { CategoryValidationError } from "@/lib/errors/validation-errors";

export async function getCategoryTree() {
  const all = await prisma.category.findMany({
    include: {
      _count: { select: { documents: true, children: true } },
    },
    orderBy: { name: "asc" },
  });

  const map = new Map(all.map((c) => [c.id, { ...c, children: [] as typeof all }]));
  const roots: (typeof all[number] & { children: typeof all })[] = [];

  for (const cat of map.values()) {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots;
}

export async function createCategory(data: CategoryCreate) {
  return prisma.$transaction(async (transaction) => {
    await lockCategoryTree(transaction);
    const parentId = data.parentId ?? null;
    const name = data.name.trim();
    if (parentId) {
      const parent = await transaction.category.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new CategoryValidationError("Kategoria nadrzędna nie istnieje");
      }
    }

    return transaction.category.create({
      data: {
        name,
        nameNormalized: normalizeCategoryName(name),
        parentId,
        parentScope: getCategoryParentScope(parentId),
      },
    });
  });
}

export async function updateCategory(id: string, data: Partial<CategoryCreate>) {
  return prisma.$transaction(async (transaction) => {
    await lockCategoryTree(transaction);
    const current = await transaction.category.findUnique({
      where: { id },
      select: { name: true, parentId: true },
    });
    if (!current) {
      throw Object.assign(new Error("Kategoria nie istnieje"), { code: "P2025" });
    }

    const name = (data.name ?? current.name).trim();
    const parentId = data.parentId === undefined ? current.parentId : data.parentId;
    await assertValidParentChain(transaction, id, parentId);

    return transaction.category.update({
      where: { id },
      data: {
        name,
        nameNormalized: normalizeCategoryName(name),
        parentId,
        parentScope: getCategoryParentScope(parentId),
      },
    });
  });
}

const CATEGORY_TREE_LOCK_ID = 7_219_840_221_607_160n;

async function lockCategoryTree(transaction: Prisma.TransactionClient) {
  await transaction.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock($1::bigint)`,
    CATEGORY_TREE_LOCK_ID,
  );
}

async function assertValidParentChain(
  transaction: Prisma.TransactionClient,
  categoryId: string,
  parentId: string | null,
) {
  let currentParentId = parentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (currentParentId === categoryId || visited.has(currentParentId)) {
      throw new CategoryValidationError(
        "Wybrana kategoria nadrzędna utworzyłaby cykl w drzewie",
      );
    }
    visited.add(currentParentId);

    const parent = await transaction.category.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    if (!parent) {
      throw new CategoryValidationError("Kategoria nadrzędna nie istnieje");
    }
    currentParentId = parent.parentId;
  }
}

export async function deleteCategory(id: string) {
  return prisma.$transaction(async (transaction) => {
    await lockCategoryTree(transaction);
    const locked = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Category" WHERE "id" = $1 FOR UPDATE`,
      id,
    );
    if (locked.length === 0) {
      throw Object.assign(new Error("Kategoria nie istnieje"), {
        code: "P2025",
      });
    }

    const category = await transaction.category.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, documents: true } },
      },
    });
    if (!category) {
      throw Object.assign(new Error("Kategoria nie istnieje"), {
        code: "P2025",
      });
    }

    if (category._count.children > 0) {
      throw new CategoryValidationError(
        `Nie można usunąć kategorii z ${category._count.children} podkategoriami. Usuń najpierw podkategorie.`,
      );
    }

    if (category._count.documents > 0) {
      throw new CategoryValidationError(
        `Nie można usunąć kategorii przypisanej do ${category._count.documents} dokumentów.`,
      );
    }

    return transaction.category.delete({ where: { id } });
  });
}
