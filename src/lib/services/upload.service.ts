import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { parseKSeFXml, isKSeFXml } from "@/lib/ksef/xml-parser";
import { DuplicateError } from "./document.service";
import {
  documentCreateSchema,
  nipSchema,
  pdfUploadSchema,
} from "@/lib/validators/schemas";
import { parseMoney } from "@/lib/money";
import { getUploadFileValidationError } from "@/lib/validators/upload";
import {
  createAttachmentLocation,
  removeAttachmentIfExists,
  writeAttachment,
} from "@/lib/storage/attachment-storage";
import { logAttachmentCleanupError } from "@/lib/storage/attachment-logger";

async function persistDocumentWithAttachment<T>(
  filePath: string,
  buffer: Buffer,
  createRecord: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  // Zapis pliku poprzedza jakikolwiek zapis w bazie. Jeżeli ten krok zawiedzie,
  // callback transakcji nie zostanie uruchomiony.
  await writeAttachment(filePath, buffer);

  try {
    return await prisma.$transaction(createRecord);
  } catch (error) {
    try {
      await removeAttachmentIfExists(filePath);
    } catch (cleanupError) {
      logAttachmentCleanupError(
        "rollback-upload-after-database-error",
        filePath,
        cleanupError
      );
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export async function handleUpload(file: File, overrides?: Record<string, string>) {
  const fileValidationError = getUploadFileValidationError(file);
  if (fileValidationError) {
    throw new ValidationError(fileValidationError);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.type.includes("xml") ? ".xml" : ".pdf";
  const { fileName, filePath } = createAttachmentLocation(ext);

  if (file.type.includes("xml")) {
    return handleXmlUpload(buffer, fileName, filePath);
  }

  return handlePdfUpload(buffer, fileName, filePath, overrides);
}

async function handleXmlUpload(buffer: Buffer, fileName: string, filePath: string) {
  const content = buffer.toString("utf-8");

  if (!isKSeFXml(content)) {
    throw new ValidationError("Nie udało się sparsować pliku XML. Sprawdź czy to prawidłowa faktura KSeF.");
  }

  const parsed = parseKSeFXml(content);

  const sellerNip = nipSchema.safeParse(parsed.seller.nip);
  if (!sellerNip.success) {
    throw new ValidationError("Brak poprawnego NIP sprzedawcy w pliku XML");
  }

  try {
    return await persistDocumentWithAttachment(
      filePath,
      buffer,
      async (transaction) => {
        const contractor = await transaction.contractor.upsert({
          where: { nip: sellerNip.data },
          update: {},
          create: {
            name: parsed.seller.name,
            nip: sellerNip.data,
            address: parsed.seller.address,
          },
        });

        const existing = await transaction.document.findUnique({
          where: {
            unique_invoice: {
              invoiceNumber: parsed.invoiceNumber,
              contractorId: contractor.id,
            },
          },
        });
        if (existing) {
          throw new DuplicateError(
            `Faktura o numerze ${parsed.invoiceNumber} od kontrahenta ${contractor.name} już istnieje w systemie`
          );
        }

        const costType = await transaction.documentType.findFirst({
          where: { direction: "PAYABLE", isSystem: true },
        });
        if (!costType) {
          throw new ValidationError(
            "Brak systemowego typu dokumentu dla faktur kosztowych"
          );
        }

        const documentData = documentCreateSchema.safeParse({
          invoiceNumber: parsed.invoiceNumber,
          documentTypeId: costType.id,
          contractorId: contractor.id,
          issueDate: parsed.issueDate,
          dueDate: parsed.dueDate || parsed.issueDate,
          amountNet: parsed.amountNet,
          amountVat: parsed.amountVat,
          amountGross: parsed.amountGross,
          bankAccountNumber: parsed.bankAccountNumber || "",
          categoryId: contractor.defaultCategoryId,
          source: "UPLOAD",
          status: "BUFFER",
        });
        if (!documentData.success) {
          throw new ValidationError(
            documentData.error.issues[0]?.message ??
              "Nieprawidłowe dane w pliku XML"
          );
        }

        return transaction.document.create({
          data: {
            invoiceNumber: documentData.data.invoiceNumber,
            documentTypeId: documentData.data.documentTypeId,
            contractorId: documentData.data.contractorId,
            issueDate: new Date(
              `${documentData.data.issueDate}T00:00:00.000Z`
            ),
            dueDate: new Date(`${documentData.data.dueDate}T00:00:00.000Z`),
            amountNet: parseMoney(documentData.data.amountNet),
            amountVat: parseMoney(documentData.data.amountVat),
            amountGross: parseMoney(documentData.data.amountGross),
            bankAccountNumber: documentData.data.bankAccountNumber || null,
            categoryId: documentData.data.categoryId,
            source: "UPLOAD",
            status: "BUFFER",
            fileName,
            filePath,
            fileType: "application/xml",
            xmlData: JSON.parse(JSON.stringify(parsed)),
          },
          include: {
            documentType: true,
            contractor: true,
            category: true,
          },
        });
      }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateError(
        `Faktura o numerze ${parsed.invoiceNumber} już istnieje w systemie`
      );
    }
    throw error;
  }
}

async function handlePdfUpload(buffer: Buffer, fileName: string, filePath: string, overrides?: Record<string, string>) {
  const validation = pdfUploadSchema.safeParse(overrides ?? {});
  if (!validation.success) {
    throw new ValidationError(
      validation.error.issues[0]?.message ?? "Nieprawidłowe dane formularza PDF"
    );
  }
  const data = validation.data;

  try {
    return await persistDocumentWithAttachment(
      filePath,
      buffer,
      async (transaction) => {
        const existing = await transaction.document.findUnique({
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

        const contractor = await transaction.contractor.findUnique({
          where: { id: data.contractorId },
          select: { defaultCategoryId: true },
        });
        if (!contractor) {
          throw new ValidationError("Nie znaleziono kontrahenta");
        }

        return transaction.document.create({
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
            categoryId:
              data.categoryId || contractor.defaultCategoryId || null,
            source: "UPLOAD",
            status: "BUFFER",
            fileName,
            filePath,
            fileType: "application/pdf",
          },
          include: {
            documentType: true,
            contractor: true,
            category: true,
          },
        });
      }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateError(
        `Faktura o numerze ${data.invoiceNumber} od tego kontrahenta już istnieje w systemie`
      );
    }
    throw error;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
