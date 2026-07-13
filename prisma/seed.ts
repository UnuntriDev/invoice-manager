import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const invoiceSales = await prisma.documentType.upsert({
    where: { name: "Faktura sprzedażowa" },
    update: {},
    create: { name: "Faktura sprzedażowa", direction: "RECEIVABLE", isSystem: true },
  });

  const invoiceCost = await prisma.documentType.upsert({
    where: { name: "Faktura kosztowa" },
    update: {},
    create: { name: "Faktura kosztowa", direction: "PAYABLE", isSystem: true },
  });

  await prisma.documentType.upsert({
    where: { name: "Nota obciążeniowa" },
    update: {},
    create: { name: "Nota obciążeniowa", direction: "RECEIVABLE", isSystem: false },
  });

  console.log("  Typy dokumentow");

  const catKosztyOp = await prisma.category.create({
    data: { name: "Koszty operacyjne" },
  });
  const catSurowce = await prisma.category.create({
    data: { name: "Surowce", parentId: catKosztyOp.id },
  });
  const catOpakowania = await prisma.category.create({
    data: { name: "Opakowania", parentId: catKosztyOp.id },
  });
  const catTransport = await prisma.category.create({
    data: { name: "Transport", parentId: catKosztyOp.id },
  });

  const catPlantacja = await prisma.category.create({
    data: { name: "Koszty plantacji" },
  });
  const catNawozy = await prisma.category.create({
    data: { name: "Nawozy", parentId: catPlantacja.id },
  });
  await prisma.category.create({
    data: { name: "Narzędzia", parentId: catPlantacja.id },
  });

  const catPrzychody = await prisma.category.create({
    data: { name: "Przychody" },
  });
  const catSprzedazHurt = await prisma.category.create({
    data: { name: "Sprzedaż hurtowa", parentId: catPrzychody.id },
  });
  await prisma.category.create({
    data: { name: "Sprzedaż detaliczna", parentId: catPrzychody.id },
  });

  console.log("  Kategorie (drzewo)");

  const packpol = await prisma.contractor.create({
    data: {
      name: "PackPol Sp. z o.o.",
      nip: "5213000000",
      address: "ul. Przemysłowa 15, 00-001 Warszawa",
      bankAccountNumber: "61109010140000071219812874",
      defaultCategoryId: catOpakowania.id,
    },
  });

  const cukropol = await prisma.contractor.create({
    data: {
      name: "CukroPol S.A.",
      nip: "5261040828",
      address: "ul. Cukrownicza 8, 60-100 Poznań",
      bankAccountNumber: "82109017640000000145349060",
      defaultCategoryId: catSurowce.id,
    },
  });

  const transchlod = await prisma.contractor.create({
    data: {
      name: "TransChłód Sp. z o.o.",
      nip: "1132191233",
      address: "ul. Logistyczna 22, 40-200 Katowice",
      bankAccountNumber: "27114020040000300278452624",
      defaultCategoryId: catTransport.id,
    },
  });

  const ekonawoz = await prisma.contractor.create({
    data: {
      name: "EkoNawóz Jan Kowalski",
      nip: "6181003648",
      address: "ul. Rolna 3, 33-300 Nowy Sącz",
      bankAccountNumber: "44109024020000000614809029",
      defaultCategoryId: catNawozy.id,
    },
  });

  const slodkirog = await prisma.contractor.create({
    data: {
      name: "Cukiernia Słodki Róg Sp. z o.o.",
      nip: "6762464585",
      address: "ul. Floriańska 23, 31-019 Kraków",
      bankAccountNumber: "55109025900000000135097521",
      defaultCategoryId: catSprzedazHurt.id,
    },
  });

  console.log("  Kontrahenci");

  const documents = [
    {
      invoiceNumber: "FV/2026/06/001",
      documentTypeId: invoiceCost.id,
      contractorId: packpol.id,
      issueDate: new Date("2026-06-15"),
      dueDate: new Date("2026-07-15"),
      amountNet: 6000,
      amountVat: 1380,
      amountGross: 7380,
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
      amountNet: 9600,
      amountVat: 2208,
      amountGross: 11808,
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
      amountNet: 2800,
      amountVat: 644,
      amountGross: 3444,
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
      amountNet: 890,
      amountVat: 204.7,
      amountGross: 1094.7,
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
      amountNet: 8400,
      amountVat: 672,
      amountGross: 9072,
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
      amountNet: 5400,
      amountVat: 432,
      amountGross: 5832,
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
      amountNet: 12500,
      amountVat: 2875,
      amountGross: 15375,
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
      amountNet: 4800,
      amountVat: 1104,
      amountGross: 5904,
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
      amountNet: 3500,
      amountVat: 805,
      amountGross: 4305,
      categoryId: catTransport.id,
      source: "UPLOAD" as const,
      status: "BUFFER" as const,
    },
  ];

  for (const doc of documents) {
    await prisma.document.create({ data: doc });
  }

  console.log("  Dokumenty (9 rekordow: 6 zaakceptowanych, 3 w buforze)");

  await prisma.kSeFSchedule.createMany({
    data: [
      { hour: 1, minute: 0, isActive: true, fetchType: "BOTH" },
      { hour: 7, minute: 0, isActive: true, fetchType: "COST" },
      { hour: 13, minute: 0, isActive: true, fetchType: "BOTH" },
    ],
  });

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

  await prisma.columnConfig.createMany({ data: defaultColumns });

  console.log("  Konfiguracja kolumn (13 kolumn, 10 widocznych)");

  console.log("\nSeed zakończony pomyślnie!");
  console.log("   Kontrahenci: 5");
  console.log("   Kategorie: 10 (drzewo 3 poziomy)");
  console.log("   Dokumenty: 9 (6 zaakceptowanych + 3 w buforze)");
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
