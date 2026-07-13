import prisma from "@/lib/prisma";
import type { DocumentCreate, DocumentUpdate } from "@/lib/validators/schemas";
import { Prisma } from "@/generated/prisma/client";

interface ListParams {
  status?: "BUFFER" | "ACCEPTED";
  documentTypeId?: string;
  contractorId?: string;
  categoryId?: string;
  source?: "KSEF" | "UPLOAD" | "MANUAL";
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export async function listDocuments(params: ListParams = {}) {
  const where: Prisma.DocumentWhereInput = {};

  if (params.status) where.status = params.status;
  if (params.documentTypeId) where.documentTypeId = params.documentTypeId;
  if (params.contractorId) where.contractorId = params.contractorId;
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.source) where.source = params.source;

  if (params.dateFrom || params.dateTo) {
    where.issueDate = {};
    if (params.dateFrom) where.issueDate.gte = new Date(params.dateFrom);
    if (params.dateTo) where.issueDate.lte = new Date(params.dateTo);
  }

  if (params.dueDateFrom || params.dueDateTo) {
    where.dueDate = {};
    if (params.dueDateFrom) where.dueDate.gte = new Date(params.dueDateFrom);
    if (params.dueDateTo) where.dueDate.lte = new Date(params.dueDateTo);
  }

  if (params.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: "insensitive" } },
      { contractor: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.DocumentOrderByWithRelationInput = {};
  const sortField = params.sortBy || "issueDate";
  const sortOrder = params.sortOrder || "desc";

  if (sortField === "contractor") {
    orderBy.contractor = { name: sortOrder };
  } else if (sortField === "documentType") {
    orderBy.documentType = { name: sortOrder };
  } else {
    (orderBy as Record<string, string>)[sortField] = sortOrder;
  }

  return prisma.document.findMany({
    where,
    orderBy,
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });
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
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      amountNet: data.amountNet,
      amountVat: data.amountVat,
      amountGross: data.amountGross,
      bankAccountNumber: data.bankAccountNumber,
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
    data,
    include: {
      documentType: true,
      contractor: true,
      category: true,
    },
  });
}

export async function deleteDocument(id: string) {
  return prisma.document.delete({ where: { id } });
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
