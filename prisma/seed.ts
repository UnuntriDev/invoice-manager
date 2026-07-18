import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getCategoryParentScope,
  normalizeCategoryName,
} from "../src/lib/category-key";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function seedDatabase(tx: Prisma.TransactionClient) {
  async function getOrCreateCategory(name: string, parentId: string | null = null) {
    const existing = await tx.category.findFirst({
      where: { name, parentId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (existing) {
      return existing;
    }

    return tx.category.create({
      data: {
        name,
        nameNormalized: normalizeCategoryName(name),
        parentId,
        parentScope: getCategoryParentScope(parentId),
      },
    });
  }

  const invoiceSales = await tx.documentType.upsert({
    where: { name: "Faktura sprzedażowa" },
    update: { direction: "RECEIVABLE", isSystem: true },
    create: { name: "Faktura sprzedażowa", direction: "RECEIVABLE", isSystem: true },
  });

  const invoiceCost = await tx.documentType.upsert({
    where: { name: "Faktura kosztowa" },
    update: { direction: "PAYABLE", isSystem: true },
    create: { name: "Faktura kosztowa", direction: "PAYABLE", isSystem: true },
  });

  await tx.documentType.upsert({
    where: { name: "Nota obciążeniowa" },
    update: { direction: "RECEIVABLE", isSystem: false },
    create: { name: "Nota obciążeniowa", direction: "RECEIVABLE", isSystem: false },
  });

  console.log("  Typy dokumentow");

  const catKosztyOp = await getOrCreateCategory("Koszty operacyjne");
  const catSurowce = await getOrCreateCategory("Surowce", catKosztyOp.id);
  const catOpakowania = await getOrCreateCategory("Opakowania", catKosztyOp.id);
  const catTransport = await getOrCreateCategory("Transport", catKosztyOp.id);

  const catPlantacja = await getOrCreateCategory("Koszty plantacji");
  const catNawozy = await getOrCreateCategory("Nawozy", catPlantacja.id);
  await getOrCreateCategory("Narzędzia", catPlantacja.id);

  const catPrzychody = await getOrCreateCategory("Przychody");
  const catSprzedazHurt = await getOrCreateCategory("Sprzedaż hurtowa", catPrzychody.id);
  await getOrCreateCategory("Sprzedaż detaliczna", catPrzychody.id);

  console.log("  Kategorie (drzewo)");

  const packpolData = {
    name: "PackPol Sp. z o.o.",
    nip: "5213000009",
    address: "ul. Przemysłowa 15, 00-001 Warszawa",
    bankAccountNumber: "61109010140000071219812874",
    defaultCategoryId: catOpakowania.id,
  };
  const packpol = await tx.contractor.upsert({
    where: { nip: packpolData.nip },
    update: packpolData,
    create: packpolData,
  });

  const cukropolData = {
    name: "CukroPol S.A.",
    nip: "5261040828",
    address: "ul. Cukrownicza 8, 60-100 Poznań",
    bankAccountNumber: "82109017640000000145349060",
    defaultCategoryId: catSurowce.id,
  };
  const cukropol = await tx.contractor.upsert({
    where: { nip: cukropolData.nip },
    update: cukropolData,
    create: cukropolData,
  });

  const transchlodData = {
    name: "TransChłód Sp. z o.o.",
    nip: "1132191233",
    address: "ul. Logistyczna 22, 40-200 Katowice",
    bankAccountNumber: "27114020040000300278452624",
    defaultCategoryId: catTransport.id,
  };
  const transchlod = await tx.contractor.upsert({
    where: { nip: transchlodData.nip },
    update: transchlodData,
    create: transchlodData,
  });

  const ekonawozData = {
    name: "EkoNawóz Jan Kowalski",
    nip: "6181003642",
    address: "ul. Rolna 3, 33-300 Nowy Sącz",
    bankAccountNumber: "44109024020000000614809029",
    defaultCategoryId: catNawozy.id,
  };
  const ekonawoz = await tx.contractor.upsert({
    where: { nip: ekonawozData.nip },
    update: ekonawozData,
    create: ekonawozData,
  });

  const slodkirogData = {
    name: "Cukiernia Słodki Róg Sp. z o.o.",
    nip: "6762464586",
    address: "ul. Floriańska 23, 31-019 Kraków",
    bankAccountNumber: "55109025900000000135097521",
    defaultCategoryId: catSprzedazHurt.id,
  };
  const slodkirog = await tx.contractor.upsert({
    where: { nip: slodkirogData.nip },
    update: slodkirogData,
    create: slodkirogData,
  });

  console.log("  Kontrahenci");

  const documents = [
    {
      invoiceNumber: "FV/2026/06/001",
      documentTypeId: invoiceCost.id,
      contractorId: packpol.id,
      issueDate: new Date("2026-06-15"),
      dueDate: new Date("2026-07-15"),
      amountNet: "6000.00",
      amountVat: "1380.00",
      amountGross: "7380.00",
      categoryId: catOpakowania.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100001",
      status: "ACCEPTED" as const,
      bankAccountNumber: "61109010140000071219812874",
    },
    {
      invoiceNumber: "FV/2026/06/015",
      documentTypeId: invoiceCost.id,
      contractorId: cukropol.id,
      issueDate: new Date("2026-06-20"),
      dueDate: new Date("2026-07-20"),
      amountNet: "9600.00",
      amountVat: "2208.00",
      amountGross: "11808.00",
      categoryId: catSurowce.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100002",
      status: "ACCEPTED" as const,
      bankAccountNumber: "82109017640000000145349060",
    },
    {
      invoiceNumber: "FV/2026/07/003",
      documentTypeId: invoiceCost.id,
      contractorId: transchlod.id,
      issueDate: new Date("2026-07-02"),
      dueDate: new Date("2026-07-16"),
      amountNet: "2800.00",
      amountVat: "644.00",
      amountGross: "3444.00",
      categoryId: catTransport.id,
      source: "UPLOAD" as const,
      status: "ACCEPTED" as const,
      bankAccountNumber: "27114020040000300278452624",
    },
    {
      invoiceNumber: "FV/2026/07/008",
      documentTypeId: invoiceCost.id,
      contractorId: ekonawoz.id,
      issueDate: new Date("2026-07-05"),
      dueDate: new Date("2026-08-04"),
      amountNet: "890.00",
      amountVat: "204.70",
      amountGross: "1094.70",
      categoryId: catNawozy.id,
      source: "MANUAL" as const,
      status: "ACCEPTED" as const,
    },
    {
      invoiceNumber: "GJ/2026/06/042",
      documentTypeId: invoiceSales.id,
      contractorId: slodkirog.id,
      issueDate: new Date("2026-06-28"),
      dueDate: new Date("2026-07-28"),
      amountNet: "8400.00",
      amountVat: "672.00",
      amountGross: "9072.00",
      categoryId: catSprzedazHurt.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100003",
      status: "ACCEPTED" as const,
    },
    {
      invoiceNumber: "GJ/2026/07/001",
      documentTypeId: invoiceSales.id,
      contractorId: slodkirog.id,
      issueDate: new Date("2026-07-08"),
      dueDate: new Date("2026-08-07"),
      amountNet: "5400.00",
      amountVat: "432.00",
      amountGross: "5832.00",
      categoryId: catSprzedazHurt.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100004",
      status: "ACCEPTED" as const,
    },
    {
      invoiceNumber: "FV/2026/07/012",
      documentTypeId: invoiceCost.id,
      contractorId: packpol.id,
      issueDate: new Date("2026-07-10"),
      dueDate: new Date("2026-08-09"),
      amountNet: "12500.00",
      amountVat: "2875.00",
      amountGross: "15375.00",
      categoryId: catOpakowania.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100005",
      status: "BUFFER" as const,
      bankAccountNumber: "61109010140000071219812874",
    },
    {
      invoiceNumber: "FV/2026/07/013",
      documentTypeId: invoiceCost.id,
      contractorId: cukropol.id,
      issueDate: new Date("2026-07-11"),
      dueDate: new Date("2026-08-10"),
      amountNet: "4800.00",
      amountVat: "1104.00",
      amountGross: "5904.00",
      categoryId: catSurowce.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100006",
      status: "BUFFER" as const,
    },
    {
      invoiceNumber: "FV/2026/07/014",
      documentTypeId: invoiceCost.id,
      contractorId: transchlod.id,
      issueDate: new Date("2026-07-12"),
      dueDate: new Date("2026-07-26"),
      amountNet: "3500.00",
      amountVat: "805.00",
      amountGross: "4305.00",
      categoryId: catTransport.id,
      source: "UPLOAD" as const,
      status: "BUFFER" as const,
    },
    {
      invoiceNumber: "FV/2026/06/002",
      documentTypeId: invoiceCost.id,
      contractorId: transchlod.id,
      issueDate: new Date("2026-06-22"),
      dueDate: new Date("2026-07-15"),
      amountNet: "4200.00",
      amountVat: "966.00",
      amountGross: "5166.00",
      categoryId: catTransport.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100007",
      status: "ACCEPTED" as const,
      bankAccountNumber: "27114020040000300278452624",
    },
    {
      invoiceNumber: "FV/2026/06/010",
      documentTypeId: invoiceCost.id,
      contractorId: packpol.id,
      issueDate: new Date("2026-06-18"),
      dueDate: new Date("2026-07-18"),
      amountNet: "8750.00",
      amountVat: "2012.50",
      amountGross: "10762.50",
      categoryId: catOpakowania.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100008",
      status: "ACCEPTED" as const,
      bankAccountNumber: "61109010140000071219812874",
    },
    {
      invoiceNumber: "FV/2026/07/002",
      documentTypeId: invoiceCost.id,
      contractorId: ekonawoz.id,
      issueDate: new Date("2026-07-01"),
      dueDate: new Date("2026-07-31"),
      amountNet: "3400.00",
      amountVat: "782.00",
      amountGross: "4182.00",
      categoryId: catNawozy.id,
      source: "MANUAL" as const,
      status: "ACCEPTED" as const,
    },
    {
      invoiceNumber: "GJ/2026/07/005",
      documentTypeId: invoiceSales.id,
      contractorId: slodkirog.id,
      issueDate: new Date("2026-07-14"),
      dueDate: new Date("2026-08-13"),
      amountNet: "6200.00",
      amountVat: "496.00",
      amountGross: "6696.00",
      categoryId: catSprzedazHurt.id,
      source: "KSEF" as const,
      ksefNumber: "1234567890-01-100009",
      status: "BUFFER" as const,
    },
  ];

  for (const doc of documents) {
    await tx.document.upsert({
      where: {
        unique_invoice: {
          invoiceNumber: doc.invoiceNumber,
          contractorId: doc.contractorId,
        },
      },
      update: doc,
      create: doc,
    });
  }

  console.log("  Dokumenty (13 rekordow: 9 zaakceptowanych, 4 w buforze)");

  const schedules = [
    { hour: 1, minute: 0, isActive: true, fetchType: "BOTH" },
    { hour: 7, minute: 0, isActive: true, fetchType: "COST" },
    { hour: 13, minute: 0, isActive: true, fetchType: "BOTH" },
  ];

  for (const schedule of schedules) {
    const existing = await tx.kSeFSchedule.findFirst({
      where: {
        hour: schedule.hour,
        minute: schedule.minute,
        fetchType: schedule.fetchType,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (existing) {
      await tx.kSeFSchedule.update({
        where: { id: existing.id },
        data: { isActive: schedule.isActive },
      });
    } else {
      await tx.kSeFSchedule.create({ data: schedule });
    }
  }

  console.log("  Harmonogram KSeF (3 wpisy: 1:00, 7:00, 13:00)");

  const defaultColumns = [
    { columnKey: "invoiceNumber", isVisible: true, position: 0 },
    { columnKey: "documentType", isVisible: true, position: 1 },
    { columnKey: "contractor", isVisible: true, position: 2 },
    { columnKey: "issueDate", isVisible: true, position: 3 },
    { columnKey: "dueDate", isVisible: true, position: 4 },
    { columnKey: "amountNet", isVisible: true, position: 5 },
    { columnKey: "amountVat", isVisible: true, position: 6 },
    { columnKey: "amountGross", isVisible: true, position: 7 },
    { columnKey: "category", isVisible: true, position: 8 },
    { columnKey: "source", isVisible: true, position: 9 },
    { columnKey: "status", isVisible: false, position: 10 },
    { columnKey: "ksefNumber", isVisible: false, position: 11 },
    { columnKey: "bankAccountNumber", isVisible: false, position: 12 },
  ];

  for (const column of defaultColumns) {
    await tx.columnConfig.upsert({
      where: { columnKey: column.columnKey },
      update: {
        isVisible: column.isVisible,
        position: column.position,
      },
      create: column,
    });
  }

  console.log("  Konfiguracja kolumn (13 kolumn, 10 widocznych)");
}

async function main() {
  console.log("Seeding database...");

  await prisma.$transaction(
    async (tx) => {
      // Serializuje cały seed, aby równoległe uruchomienia nie rozjechały
      // zależności między rekordami. Unikalność nazw rodzeństwa kategorii
      // jest dodatkowo wymuszana w bazie przez (parentScope, nameNormalized).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-manager-seed-v1'))`;
      await seedDatabase(tx);
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  console.log("\nSeed zakończony pomyślnie!");
  console.log("   Kontrahenci: 5");
  console.log("   Kategorie: 10 (drzewo 2-poziomowe)");
  console.log("   Dokumenty: 13 (9 zaakceptowanych + 4 w buforze)");
  console.log("   Typy dokumentow: 3 (2 systemowe + 1 custom)");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
