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
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({ where: { id } });
}
