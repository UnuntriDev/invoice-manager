import prisma from "@/lib/prisma";
import type {
  DocumentCreate,
  DocumentListQuery,
  DocumentUpdate,
} from "@/lib/validators/schemas";
import type { Prisma } from "@/generated/prisma/client";
import { parseMoney } from "@/lib/money";
import {
  finalizeStagedAttachment,
  readAttachment,
  restoreStagedAttachment,
  stageAttachmentForDeletion,
  type StagedAttachment,
  writeAttachment,
} from "@/lib/storage/attachment-storage";
import {
  logAttachmentCleanupError,
  logMissingAttachment,
} from "@/lib/storage/attachment-logger";

export async function listAcceptedDocuments(params: DocumentListQuery) {
  // Status rejestru jest częścią kontraktu serwera i nie może zostać
  // nadpisany parametrem zapytania przekazanym przez klienta.
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

  const documents = await prisma.document.findMany({
    where,
    orderBy,
    take: params.pageSize + 1,
    ...(params.cursor
      ? { cursor: { id: params.cursor }, skip: 1 }
      : {}),
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });

  const hasNextPage = documents.length > params.pageSize;
  const items = hasNextPage ? documents.slice(0, params.pageSize) : documents;

  return {
    items,
    nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
  };
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });
}

export async function createDocument(data: DocumentCreate) {
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
      source: data.source,
      ksefNumber: data.ksefNumber,
      status: data.status,
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
  const document = await prisma.document.findUnique({
    where: { id },
    select: { filePath: true },
  });

  // Zachowujemy dotychczasową semantykę Prisma P2025 dla nieistniejącego ID.
  if (!document) {
    return prisma.document.delete({ where: { id } });
  }

  if (!document.filePath) {
    return prisma.document.delete({ where: { id } });
  }

  let stagedAttachment: StagedAttachment | null;
  try {
    stagedAttachment = await stageAttachmentForDeletion(document.filePath);
  } catch (error) {
    logAttachmentCleanupError(
      "stage-before-document-delete",
      document.filePath,
      error
    );
    throw error;
  }

  // Brak pliku nie blokuje usunięcia osieroconego rekordu z bazy.
  if (!stagedAttachment) {
    logMissingAttachment(id, document.filePath);
    return prisma.document.delete({ where: { id } });
  }

  const attachmentBackup = await readAttachment(stagedAttachment.stagedPath);
  if (!attachmentBackup) {
    const error = new Error(
      "Załącznik zniknął podczas przygotowania do usunięcia dokumentu"
    );
    logAttachmentCleanupError(
      "read-staged-attachment-before-delete",
      stagedAttachment.stagedPath,
      error
    );
    try {
      await restoreStagedAttachment(stagedAttachment);
    } catch (restoreError) {
      logAttachmentCleanupError(
        "restore-unreadable-staged-attachment",
        stagedAttachment.originalPath,
        restoreError
      );
    }
    throw error;
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const deleted = await transaction.document.delete({ where: { id } });
      try {
        await finalizeStagedAttachment(stagedAttachment);
      } catch (error) {
        logAttachmentCleanupError(
          "finalize-document-attachment-delete",
          stagedAttachment.stagedPath,
          error
        );
        // Odrzucenie callbacku wycofuje usunięcie rekordu w bazie.
        throw error;
      }
      return deleted;
    });
  } catch (error) {
    try {
      await restoreStagedAttachment(stagedAttachment);
    } catch {
      try {
        const originalFile = await readAttachment(stagedAttachment.originalPath);
        if (!originalFile) {
          await writeAttachment(
            stagedAttachment.originalPath,
            attachmentBackup
          );
        }
      } catch (backupRestoreError) {
        logAttachmentCleanupError(
          "restore-after-document-delete-failure",
          stagedAttachment.originalPath,
          backupRestoreError
        );
      }
    }
    throw error;
  }
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

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}
