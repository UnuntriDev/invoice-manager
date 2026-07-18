import prisma from "@/lib/prisma";
import type {
  DocumentListQuery,
  ManualDocumentCreate,
  DocumentUpdate,
} from "@/lib/validators/schemas";
import type { Prisma } from "@/generated/prisma/client";
import { parseMoney } from "@/lib/money";
import { processAttachmentCleanupTask } from "@/lib/services/attachment-reconciliation.service";
import { DuplicateError } from "@/lib/errors/validation-errors";

export { DuplicateError } from "@/lib/errors/validation-errors";

export const documentListSelect = {
  id: true,
  invoiceNumber: true,
  documentTypeId: true,
  documentType: {
    select: { id: true, name: true, direction: true, isSystem: true },
  },
  contractorId: true,
  contractor: {
    select: {
      id: true,
      name: true,
      nip: true,
      address: true,
      bankAccountNumber: true,
      defaultCategoryId: true,
    },
  },
  issueDate: true,
  dueDate: true,
  amountNet: true,
  amountVat: true,
  amountGross: true,
  bankAccountNumber: true,
  categoryId: true,
  category: { select: { id: true, name: true, parentId: true } },
  source: true,
  ksefNumber: true,
  status: true,
  fileName: true,
  fileType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const documentDetailSelect = {
  ...documentListSelect,
  xmlData: true,
} satisfies Prisma.DocumentSelect;

export async function listAcceptedDocuments(params: DocumentListQuery) {
  // Status wymuszony serwerowo
  const where: Prisma.DocumentWhereInput = { status: "ACCEPTED" };

  if (params.documentTypeId) where.documentTypeId = params.documentTypeId;
  if (params.contractorId) where.contractorId = params.contractorId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.source) where.source = params.source;

  if (params.dateFrom || params.dateTo) {
    where.issueDate = {};
    if (params.dateFrom) {
      where.issueDate.gte = new Date(`${params.dateFrom}T00:00:00.000Z`);
    }
    if (params.dateTo) {
      where.issueDate.lte = new Date(`${params.dateTo}T00:00:00.000Z`);
    }
  }

  if (params.dueDateFrom || params.dueDateTo) {
    where.dueDate = {};
    if (params.dueDateFrom) {
      where.dueDate.gte = new Date(`${params.dueDateFrom}T00:00:00.000Z`);
    }
    if (params.dueDateTo) {
      where.dueDate.lte = new Date(`${params.dueDateTo}T00:00:00.000Z`);
    }
  }

  if (params.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: "insensitive" } },
      { contractor: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const orderBy = [
    { [params.sortBy]: params.sortOrder },
    { id: params.sortOrder },
  ] as Prisma.DocumentOrderByWithRelationInput[];

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy,
      take: params.pageSize + 1,
      ...(params.cursor
        ? { cursor: { id: params.cursor }, skip: 1 }
        : {}),
      select: documentListSelect,
    }),
    prisma.document.count({ where }),
  ]);

  const hasNextPage = documents.length > params.pageSize;
  const items = hasNextPage ? documents.slice(0, params.pageSize) : documents;

  return {
    items,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
    total,
  };
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({
    where: { id },
    select: documentDetailSelect,
  });
}

export async function getDocumentAttachment(id: string) {
  return prisma.document.findUnique({
    where: { id },
    select: { fileKey: true, fileName: true, fileType: true },
  });
}

export async function createDocument(data: ManualDocumentCreate) {
  const existing = await prisma.document.findUnique({
    where: {
      unique_invoice: {
        invoiceNumber: data.invoiceNumber,
        contractorId: data.contractorId,
      },
    },
  });

  if (existing) {
    throw new DuplicateError(
      `Faktura o numerze ${data.invoiceNumber} od tego kontrahenta już istnieje w systemie`
    );
  }

  let categoryId = data.categoryId;
  if (!categoryId) {
    const contractor = await prisma.contractor.findUnique({
      where: { id: data.contractorId },
      select: { defaultCategoryId: true },
    });
    if (contractor?.defaultCategoryId) {
      categoryId = contractor.defaultCategoryId;
    }
  }

  return prisma.document.create({
    data: {
      invoiceNumber: data.invoiceNumber,
      documentTypeId: data.documentTypeId,
      contractorId: data.contractorId,
      issueDate: new Date(`${data.issueDate}T00:00:00.000Z`),
      dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
      amountNet: parseMoney(data.amountNet),
      amountVat: parseMoney(data.amountVat),
      amountGross: parseMoney(data.amountGross),
      bankAccountNumber: data.bankAccountNumber || null,
      categoryId,
      source: "MANUAL",
      ksefNumber: null,
      status: "ACCEPTED",
    },
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });
}

export async function updateDocument(id: string, data: DocumentUpdate) {
  return prisma.document.update({
    where: { id },
    data: {
      invoiceNumber: data.invoiceNumber,
      documentTypeId: data.documentTypeId,
      contractorId: data.contractorId,
      issueDate: new Date(`${data.issueDate}T00:00:00.000Z`),
      dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
      amountNet: parseMoney(data.amountNet),
      amountVat: parseMoney(data.amountVat),
      amountGross: parseMoney(data.amountGross),
      bankAccountNumber: data.bankAccountNumber || null,
      categoryId: data.categoryId,
    },
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });
}

export async function deleteDocument(id: string) {
  const { deleted, fileKey } = await prisma.$transaction(async (transaction) => {
    const document = await transaction.document.findUnique({
      where: { id },
      select: { fileKey: true },
    });

    if (!document) {
      return {
        deleted: await transaction.document.delete({ where: { id } }),
        fileKey: null,
      };
    }

    if (document.fileKey) {
      await transaction.attachmentCleanupTask.upsert({
        where: { fileKey: document.fileKey },
        update: { nextAttemptAt: new Date(), lastError: null },
        create: { fileKey: document.fileKey },
      });
    }

    return {
      deleted: await transaction.document.delete({ where: { id } }),
      fileKey: document.fileKey,
    };
  });

  // Cleanup po COMMIT; przy awarii reconciler ponowi
  if (fileKey) {
    await processAttachmentCleanupTask(fileKey);
  }

  return deleted;
}
