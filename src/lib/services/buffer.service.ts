import prisma from "@/lib/prisma";

export async function listBufferDocuments() {
  return prisma.document.findMany({
    where: { status: "BUFFER" },
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptDocuments(documentIds: string[]) {
  const result = await prisma.document.updateMany({
    where: {
      id: { in: documentIds },
      status: "BUFFER",
    },
    data: { status: "ACCEPTED" },
  });
  return result.count;
}
