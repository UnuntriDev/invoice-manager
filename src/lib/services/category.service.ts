import prisma from "@/lib/prisma";
import type { CategoryCreate } from "@/lib/validators/schemas";

export async function listCategories() {
  return prisma.category.findMany({
    include: { children: true },
    orderBy: { name: "asc" },
  });
}

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
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Partial<CategoryCreate>) {
  if (data.parentId === id) {
    throw new CategoryValidationError("Kategoria nie może być swoim własnym rodzicem");
  }
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { children: true, documents: true } },
    },
  });

  if (!category) {
    throw new Error("Kategoria nie istnieje");
  }

  if (category._count.children > 0) {
    throw new CategoryValidationError(
      `Nie można usunąć kategorii z ${category._count.children} podkategoriami. Usuń najpierw podkategorie.`
    );
  }

  if (category._count.documents > 0) {
    throw new CategoryValidationError(
      `Nie można usunąć kategorii przypisanej do ${category._count.documents} dokumentów.`
    );
  }

  return prisma.category.delete({ where: { id } });
}

export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryValidationError";
  }
}
