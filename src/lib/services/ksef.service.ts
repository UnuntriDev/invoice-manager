import prisma from "@/lib/prisma";
import { createKSeFClient } from "@/lib/ksef/ksef-mock.client";
import type {
  IKSeFClient,
  KSeFFetchParams,
  KSeFInvoice,
  KSeFParty,
} from "@/lib/ksef/ksef-client.interface";
import { ksefInvoiceBatchSchema } from "@/lib/validators/schemas";
import { parseMoney } from "@/lib/money";

export type KSeFImportResult =
  | {
      success: true;
      total: number;
      imported: number;
      skipped: number;
    }
  | {
      success: false;
      error: string;
    };

class MissingDocumentTypeError extends Error {}

function failure(error: string): KSeFImportResult {
  return { success: false, error };
}

function getCounterparty(invoice: KSeFInvoice, isCost: boolean): KSeFParty {
  return isCost ? invoice.seller : invoice.buyer;
}

function removeBatchDuplicates(invoices: KSeFInvoice[], isCost: boolean) {
  const seenKsefNumbers = new Set<string>();
  const seenBusinessKeys = new Set<string>();
  const uniqueInvoices: KSeFInvoice[] = [];

  for (const invoice of invoices) {
    const counterparty = getCounterparty(invoice, isCost);
    const businessKey = JSON.stringify([invoice.invoiceNumber, counterparty.nip]);

    // Numer KSeF jest głównym kluczem idempotentności. Para numer faktury + NIP
    // pozostaje dodatkowym kluczem biznesowym zgodnym z ograniczeniem w bazie.
    if (
      seenKsefNumbers.has(invoice.ksefNumber) ||
      seenBusinessKeys.has(businessKey)
    ) {
      continue;
    }

    seenKsefNumbers.add(invoice.ksefNumber);
    seenBusinessKeys.add(businessKey);
    uniqueInvoices.push(invoice);
  }

  return uniqueInvoices;
}

export async function importKSeFBatch(
  invoices: KSeFInvoice[],
  params: KSeFFetchParams
): Promise<KSeFImportResult> {
  const validation = ksefInvoiceBatchSchema.safeParse(invoices);

  if (!validation.success) {
    const message = validation.error.issues[0]?.message ?? "Nieprawidłowy batch KSeF";
    return failure(`KSeF zwrócił nieprawidłowe dane: ${message}`);
  }

  const validatedInvoices = validation.data;
  if (validatedInvoices.length === 0) {
    return { success: true, total: 0, imported: 0, skipped: 0 };
  }

  const isCost = params.type === "COST";
  const uniqueInvoices = removeBatchDuplicates(validatedInvoices, isCost);

  try {
    const imported = await prisma.$transaction(
      async (tx) => {
        const docType = await tx.documentType.findFirst({
          where: {
            direction: isCost ? "PAYABLE" : "RECEIVABLE",
            isSystem: true,
          },
        });

        if (!docType) {
          throw new MissingDocumentTypeError(
            `Brak systemowego typu dokumentu dla faktur ${
              isCost ? "kosztowych" : "sprzedażowych"
            }`
          );
        }

        const contractorsByNip = new Map<string, { id: string; defaultCategoryId: string | null }>();

        for (const invoice of uniqueInvoices) {
          const counterparty = getCounterparty(invoice, isCost);
          if (contractorsByNip.has(counterparty.nip)) {
            continue;
          }

          const contractor = await tx.contractor.upsert({
            where: { nip: counterparty.nip },
            update: {},
            create: {
              name: counterparty.name,
              nip: counterparty.nip,
              address: counterparty.address,
            },
            select: { id: true, defaultCategoryId: true },
          });

          contractorsByNip.set(counterparty.nip, contractor);
        }

        const documents = uniqueInvoices.map((invoice) => {
          const counterparty = getCounterparty(invoice, isCost);
          const contractor = contractorsByNip.get(counterparty.nip);

          if (!contractor) {
            throw new Error(`Nie znaleziono kontrahenta o NIP ${counterparty.nip}`);
          }

          return {
            invoiceNumber: invoice.invoiceNumber,
            documentTypeId: docType.id,
            contractorId: contractor.id,
            issueDate: new Date(`${invoice.issueDate}T00:00:00.000Z`),
            dueDate: new Date(`${invoice.dueDate}T00:00:00.000Z`),
            amountNet: parseMoney(invoice.amountNet),
            amountVat: parseMoney(invoice.amountVat),
            amountGross: parseMoney(invoice.amountGross),
            bankAccountNumber: invoice.bankAccountNumber,
            categoryId: contractor.defaultCategoryId,
            source: "KSEF" as const,
            ksefNumber: invoice.ksefNumber,
            status: "BUFFER" as const,
            xmlData: { xmlContent: invoice.xmlContent },
          };
        });

        // PostgreSQL realizuje skipDuplicates przez ON CONFLICT DO NOTHING.
        // Obejmuje to numer KSeF, klucz biznesowy i duplikaty współbieżne.
        const created = await tx.document.createMany({
          data: documents,
          skipDuplicates: true,
        });

        return created.count;
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    return {
      success: true,
      total: validatedInvoices.length,
      imported,
      skipped: validatedInvoices.length - imported,
    };
  } catch (error) {
    if (error instanceof MissingDocumentTypeError) {
      return failure(error.message);
    }

    console.error("[KSeF] Batch import transaction failed:", error);
    return failure(
      "Nie udało się zapisać dokumentów z KSeF. Żadne dane nie zostały zapisane."
    );
  }
}

export async function fetchFromKSeF(
  params: KSeFFetchParams,
  client: IKSeFClient = createKSeFClient()
): Promise<KSeFImportResult> {
  let invoices: KSeFInvoice[];

  try {
    invoices = await client.fetchInvoices(params);
  } catch (error) {
    console.error("[KSeF] Fetch failed:", error);
    return failure("Nie udało się połączyć z KSeF. Spróbuj ponownie.");
  }

  return importKSeFBatch(invoices, params);
}
