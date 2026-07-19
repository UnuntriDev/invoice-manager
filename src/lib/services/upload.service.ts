import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { parseKSeFXml } from "@/lib/ksef/xml-parser";
import { DuplicateError } from "@/lib/errors/validation-errors";
import {
  documentCreateSchema,
  nipSchema,
  pdfUploadSchema,
} from "@/lib/validators/schemas";
import { parseMoney } from "@/lib/money";
import {
  getMaxUploadSizeBytes,
  getUploadFileValidationError,
} from "@/lib/validators/upload";
import { validateUploadBuffer } from "@/lib/validators/upload-content";
import { resolveCategoryFromRules } from "@/lib/services/categorization-rule.service";
import {
  createAttachmentLocation,
  removeAttachmentIfExists,
  writeAttachment,
} from "@/lib/storage/attachment-storage";
import { logAttachmentCleanupError } from "@/lib/storage/attachment-logger";
import { ValidationError } from "@/lib/errors/validation-errors";
import { getCompanyNip } from "@/lib/env";

export { ValidationError } from "@/lib/errors/validation-errors";

async function persistDocumentWithAttachment<T>(
  fileKey: string,
  buffer: Buffer,
  createRecord: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  // Plik przed DB: błąd tutaj = brak zapisu w bazie
  await writeAttachment(fileKey, buffer);

  try {
    return await prisma.$transaction(createRecord);
  } catch (error) {
    try {
      await removeAttachmentIfExists(fileKey);
    } catch (cleanupError) {
      logAttachmentCleanupError(
        "rollback-upload-after-database-error",
        fileKey,
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
  const maxSizeBytes = getMaxUploadSizeBytes();
  const fileValidationError = getUploadFileValidationError(file, maxSizeBytes);
  if (fileValidationError) {
    throw new ValidationError(fileValidationError);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  let validatedFile: ReturnType<typeof validateUploadBuffer>;
  try {
    validatedFile = validateUploadBuffer(file, buffer, maxSizeBytes);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "Nieprawidłowy plik",
    );
  }
  const ext = validatedFile.kind === "xml" ? ".xml" : ".pdf";
  const { fileName, fileKey } = createAttachmentLocation(ext);

  if (validatedFile.kind === "xml") {
    return handleXmlUpload(
      buffer,
      validatedFile.xmlContent!,
      fileName,
      fileKey,
    );
  }

  return handlePdfUpload(buffer, fileName, fileKey, overrides);
}

async function handleXmlUpload(
  buffer: Buffer,
  content: string,
  fileName: string,
  fileKey: string,
) {
  let parsed: ReturnType<typeof parseKSeFXml>;
  try {
    parsed = parseKSeFXml(content);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error
        ? error.message
        : "Nie udało się sparsować pliku XML",
    );
  }

  const sellerNip = nipSchema.safeParse(parsed.seller.nip);
  if (!sellerNip.success) {
    throw new ValidationError("Brak poprawnego NIP sprzedawcy w pliku XML");
  }
  const buyerNip = nipSchema.safeParse(parsed.buyer.nip);
  if (!buyerNip.success) {
    throw new ValidationError("Brak poprawnego NIP nabywcy w pliku XML");
  }

  const companyNip = getCompanyNip();
  const companyIsSeller = sellerNip.data === companyNip;
  const companyIsBuyer = buyerNip.data === companyNip;
  if (companyIsSeller === companyIsBuyer) {
    throw new ValidationError(
      companyIsSeller
        ? "NIP firmy występuje jednocześnie jako sprzedawca i nabywca"
        : "NIP firmy nie występuje jako sprzedawca ani nabywca dokumentu",
    );
  }

  const counterparty = companyIsSeller ? parsed.buyer : parsed.seller;
  const counterpartyNip = companyIsSeller ? buyerNip.data : sellerNip.data;
  const direction = companyIsSeller ? "RECEIVABLE" : "PAYABLE";

  try {
    return await persistDocumentWithAttachment(
      fileKey,
      buffer,
      async (transaction) => {
        const contractor = await transaction.contractor.upsert({
          where: { nip: counterpartyNip },
          update: {},
          create: {
            name: counterparty.name,
            nip: counterpartyNip,
            address: counterparty.address,
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

        const documentType = await transaction.documentType.findFirst({
          where: { direction, isSystem: true },
        });
        if (!documentType) {
          throw new ValidationError(
            `Brak systemowego typu dokumentu dla faktur ${
              direction === "PAYABLE" ? "kosztowych" : "sprzedażowych"
            }`,
          );
        }

        const documentData = documentCreateSchema.safeParse({
          invoiceNumber: parsed.invoiceNumber,
          documentTypeId: documentType.id,
          contractorId: contractor.id,
          issueDate: parsed.issueDate,
          dueDate: parsed.dueDate || parsed.issueDate,
          amountNet: parsed.amountNet,
          amountVat: parsed.amountVat,
          amountGross: parsed.amountGross,
          bankAccountNumber: parsed.bankAccountNumber || "",
          categoryId:
            contractor.defaultCategoryId ??
            (await resolveCategoryFromRules(transaction, {
              contractorName: contractor.name,
              invoiceNumber: parsed.invoiceNumber,
            })),
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
            fileKey,
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

async function handlePdfUpload(buffer: Buffer, fileName: string, fileKey: string, overrides?: Record<string, string>) {
  const validation = pdfUploadSchema.safeParse(overrides ?? {});
  if (!validation.success) {
    throw new ValidationError(
      validation.error.issues[0]?.message ?? "Nieprawidłowe dane formularza PDF"
    );
  }
  const data = validation.data;

  try {
    return await persistDocumentWithAttachment(
      fileKey,
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
          select: { defaultCategoryId: true, name: true },
        });
        if (!contractor) {
          throw new ValidationError("Nie znaleziono kontrahenta");
        }

        const resolvedCategoryId =
          data.categoryId ||
          contractor.defaultCategoryId ||
          (await resolveCategoryFromRules(transaction, {
            contractorName: contractor.name,
            invoiceNumber: data.invoiceNumber,
          }));

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
            categoryId: resolvedCategoryId || null,
            source: "UPLOAD",
            status: "BUFFER",
            fileName,
            fileKey,
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
