import { promises as fs } from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { parseKSeFXml, isKSeFXml } from "@/lib/ksef/xml-parser";
import { DuplicateError } from "./document.service";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10)) * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "text/xml",
  "application/xml",
];

export async function handleUpload(file: File, overrides?: Record<string, string>) {
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(`Plik jest za duży. Maksymalny rozmiar to ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError("Dozwolone formaty to PDF i XML");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.type.includes("xml") ? ".xml" : ".pdf";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

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

  if (!parsed.seller.nip) {
    throw new ValidationError("Brak NIP sprzedawcy w pliku XML");
  }

  let contractor = await prisma.contractor.findUnique({
    where: { nip: parsed.seller.nip },
  });

  if (!contractor) {
    contractor = await prisma.contractor.create({
      data: {
        name: parsed.seller.name,
        nip: parsed.seller.nip,
        address: parsed.seller.address,
      },
    });
  }

  const existing = await prisma.document.findUnique({
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

  const costType = await prisma.documentType.findFirst({
    where: { direction: "PAYABLE", isSystem: true },
  });

  if (!costType) {
    throw new ValidationError("Brak systemowego typu dokumentu dla faktur kosztowych");
  }

  let categoryId: string | undefined;
  if (contractor.defaultCategoryId) {
    categoryId = contractor.defaultCategoryId;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return prisma.document.create({
    data: {
      invoiceNumber: parsed.invoiceNumber,
      documentTypeId: costType.id,
      contractorId: contractor.id,
      issueDate: new Date(parsed.issueDate),
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : new Date(parsed.issueDate),
      amountNet: parsed.amountNet,
      amountVat: parsed.amountVat,
      amountGross: parsed.amountGross,
      bankAccountNumber: parsed.bankAccountNumber,
      categoryId,
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

async function handlePdfUpload(buffer: Buffer, fileName: string, filePath: string, overrides?: Record<string, string>) {
  if (!overrides?.invoiceNumber || !overrides?.contractorId || !overrides?.documentTypeId) {
    throw new ValidationError("Dla pliku PDF wymagane są: numer faktury, kontrahent i typ dokumentu");
  }

  const amountNet = parseFloat(overrides.amountNet || "0");
  const amountVat = parseFloat(overrides.amountVat || "0");
  const amountGross = parseFloat(overrides.amountGross || "0");

  if (isNaN(amountNet) || isNaN(amountVat) || isNaN(amountGross)) {
    throw new ValidationError("Kwoty muszą być liczbami");
  }

  if (amountNet < 0 || amountVat < 0 || amountGross < 0) {
    throw new ValidationError("Kwoty nie mogą być ujemne");
  }

  if (amountGross > 0 && Math.abs(amountGross - (amountNet + amountVat)) > 0.01) {
    throw new ValidationError("Kwota brutto musi być równa sumie netto + VAT");
  }

  const existing = await prisma.document.findUnique({
    where: {
      unique_invoice: {
        invoiceNumber: overrides.invoiceNumber,
        contractorId: overrides.contractorId,
      },
    },
  });

  if (existing) {
    throw new DuplicateError(
      `Faktura o numerze ${overrides.invoiceNumber} od tego kontrahenta już istnieje w systemie`
    );
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: overrides.contractorId },
    select: { defaultCategoryId: true },
  });

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return prisma.document.create({
    data: {
      invoiceNumber: overrides.invoiceNumber,
      documentTypeId: overrides.documentTypeId,
      contractorId: overrides.contractorId,
      issueDate: new Date(overrides.issueDate || new Date()),
      dueDate: new Date(overrides.dueDate || new Date()),
      amountNet,
      amountVat,
      amountGross,
      bankAccountNumber: overrides.bankAccountNumber || null,
      categoryId: overrides.categoryId || contractor?.defaultCategoryId || null,
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

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
