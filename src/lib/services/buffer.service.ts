import prisma from "@/lib/prisma";
import { ConflictError } from "@/lib/errors/validation-errors";
import type { BufferListQuery } from "@/lib/validators/schemas";
import { documentListSelect } from "@/lib/services/document.service";

export async function listBufferDocuments(params: BufferListQuery) {
  const documents = await prisma.document.findMany({
    where: { status: "BUFFER" },
    select: documentListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.pageSize + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  const hasNextPage = documents.length > params.pageSize;
  const items = hasNextPage ? documents.slice(0, params.pageSize) : documents;
  return {
    items,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
  };
}

export async function acceptDocuments(documentIds: string[]) {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRawUnsafe<
      Array<{ id: string; status: "BUFFER" | "ACCEPTED" }>
    >(
      `
      SELECT "id", "status"
      FROM "Document"
      WHERE "id" = ANY($1::text[])
      FOR UPDATE
      `,
      documentIds,
    );

    if (
      rows.length !== documentIds.length ||
      rows.some((row) => row.status !== "BUFFER")
    ) {
      throw new ConflictError(
        "Nie wszystkie dokumenty istnieją i oczekują w buforze. Nic nie zaakceptowano.",
      );
    }

    const result = await transaction.document.updateMany({
      where: { id: { in: documentIds }, status: "BUFFER" },
      data: { status: "ACCEPTED" },
    });
    if (result.count !== documentIds.length) {
      throw new ConflictError(
        "Stan bufora zmienił się równolegle. Nic nie zaakceptowano.",
      );
    }
    return result.count;
  });
}
