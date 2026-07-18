import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import prisma from "@/lib/prisma";
import { extractInvoiceFieldsFromLines } from "@/lib/pdf/invoice-text-parser";

export interface PdfExtractionResult {
  fields: {
    invoiceNumber?: string;
    contractorId?: string;
    issueDate?: string;
    dueDate?: string;
    amountNet?: string;
    amountVat?: string;
    amountGross?: string;
  };
  detected: string[];
  warnings: string[];
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

async function extractPdfLines(buffer: Buffer): Promise<string[]> {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 10); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map<number, Array<{ x: number; text: string }>>();

      for (const item of content.items as PdfTextItem[]) {
        const text = (item.str ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const x = item.transform?.[4] ?? 0;
        const y = Math.round(item.transform?.[5] ?? 0);
        const row = rows.get(y) ?? [];
        row.push({ x, text });
        rows.set(y, row);
      }

      for (const [, row] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
        lines.push(row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return lines;
}

export async function extractPdfInvoiceData(buffer: Buffer): Promise<PdfExtractionResult> {
  const lines = await extractPdfLines(buffer);
  if (lines.length === 0) {
    return {
      fields: {},
      detected: [],
      warnings: ["PDF nie zawiera warstwy tekstowej. Uzupełnij dane ręcznie."],
    };
  }

  const extracted = extractInvoiceFieldsFromLines(lines);
  const fields: PdfExtractionResult["fields"] = { ...extracted.fields };
  const matchingContractors = extracted.nips.length
    ? await prisma.contractor.findMany({
        where: { nip: { in: extracted.nips } },
        select: { id: true },
        take: 2,
      })
    : [];

  if (matchingContractors.length === 1) fields.contractorId = matchingContractors[0].id;

  const detected = Object.entries(fields)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const warnings: string[] = [];
  if (matchingContractors.length > 1) {
    warnings.push("Wykryto więcej niż jednego znanego kontrahenta. Wybierz właściwego ręcznie.");
  } else if (extracted.nips.length > 0 && matchingContractors.length === 0) {
    warnings.push("Rozpoznany NIP nie pasuje do żadnego kontrahenta w bazie.");
  }
  if (detected.length === 0) warnings.push("Nie udało się jednoznacznie rozpoznać danych. Uzupełnij formularz ręcznie.");

  return { fields, detected, warnings };
}
