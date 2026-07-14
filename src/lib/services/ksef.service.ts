import prisma from "@/lib/prisma";
import { createKSeFClient } from "@/lib/ksef/ksef-mock.client";
import type { KSeFFetchParams } from "@/lib/ksef/ksef-client.interface";

export async function fetchFromKSeF(params: KSeFFetchParams) {
  const client = createKSeFClient();

  const invoices = await client.fetchInvoices(params);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const isCost = params.type === "COST";
  const docType = await prisma.documentType.findFirst({
    where: {
      direction: isCost ? "PAYABLE" : "RECEIVABLE",
      isSystem: true,
    },
  });

  if (!docType) {
    return {
      total: invoices.length,
      imported: 0,
      skipped: 0,
      errors: [`Brak systemowego typu dokumentu dla ${isCost ? "kosztowych" : "sprzedażowych"}`],
    };
  }

  for (const inv of invoices) {
    try {
      const counterpartyNip = isCost ? inv.seller.nip : inv.buyer.nip;
      const counterpartyName = isCost ? inv.seller.name : inv.buyer.name;
      const counterpartyAddress = isCost ? inv.seller.address : inv.buyer.address;

      if (!counterpartyNip) {
        errors.push(`Faktura ${inv.invoiceNumber}: brak NIP kontrahenta`);
        continue;
      }

      let contractor = await prisma.contractor.findUnique({
        where: { nip: counterpartyNip },
      });

      if (!contractor) {
        contractor = await prisma.contractor.create({
          data: {
            name: counterpartyName,
            nip: counterpartyNip,
            address: counterpartyAddress,
          },
        });
      }

      await prisma.document.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          documentTypeId: docType.id,
          contractorId: contractor.id,
          issueDate: new Date(inv.issueDate),
          dueDate: new Date(inv.dueDate),
          amountNet: inv.amountNet,
          amountVat: inv.amountVat,
          amountGross: inv.amountGross,
          bankAccountNumber: inv.bankAccountNumber,
          categoryId: contractor.defaultCategoryId,
          source: "KSEF",
          ksefNumber: inv.ksefNumber,
          status: "BUFFER",
          xmlData: { xmlContent: inv.xmlContent },
        },
      });

      imported++;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        skipped++;
      } else {
        errors.push(`Faktura ${inv.invoiceNumber}: błąd importu`);
        console.error(`[KSeF] Import error for ${inv.invoiceNumber}:`, error);
      }
    }
  }

  return {
    total: invoices.length,
    imported,
    skipped,
    errors,
  };
}

export async function runScheduledFetch() {
  const schedules = await prisma.kSeFSchedule.findMany({
    where: { isActive: true },
  });

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const results = [];

  for (const schedule of schedules) {
    if (schedule.hour !== currentHour || schedule.minute !== currentMinute) {
      continue;
    }

    const dateTo = new Date().toISOString().split("T")[0];
    const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const types: ("COST" | "SALES")[] =
      schedule.fetchType === "BOTH"
        ? ["COST", "SALES"]
        : [schedule.fetchType as "COST" | "SALES"];

    for (const type of types) {
      try {
        const result = await fetchFromKSeF({ dateFrom, dateTo, type });
        results.push({ scheduleId: schedule.id, type, ...result });

        await prisma.kSeFSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: new Date() },
        });
      } catch (error) {
        console.error(`[CRON] Błąd pobierania KSeF (schedule ${schedule.id}, type ${type}):`, error);
        results.push({ scheduleId: schedule.id, type, error: "Błąd pobierania" });
      }
    }
  }

  return results;
}
