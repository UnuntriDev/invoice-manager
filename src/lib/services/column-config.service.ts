import prisma from "@/lib/prisma";

export async function getColumnConfig() {
  return prisma.columnConfig.findMany({
    orderBy: { position: "asc" },
  });
}

export async function updateColumnConfig(
  columns: Array<{ columnKey: string; isVisible: boolean; position: number }>
) {
  await prisma.$transaction(
    columns.map((col) =>
      prisma.columnConfig.update({
        where: { columnKey: col.columnKey },
        data: { isVisible: col.isVisible, position: col.position },
      })
    )
  );

  return getColumnConfig();
}
