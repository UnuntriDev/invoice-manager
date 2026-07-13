import { z } from "zod";

// ===================================================
// KONTRAHENT
// ===================================================

export const contractorCreateSchema = z.object({
  name: z.string().min(1, "Nazwa kontrahenta jest wymagana").max(255),
  nip: z
    .string()
    .regex(/^\d{10}$/, "NIP musi składać się z 10 cyfr")
    .refine((nip) => {
      const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
      const digits = nip.split("").map(Number);
      const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
      const remainder = sum % 11;
      return remainder !== 10 && remainder === digits[9];
    }, "Nieprawidłowy NIP — błędna cyfra kontrolna"),
  address: z.string().max(500).optional().nullable(),
  bankAccountNumber: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        const cleaned = val.replace(/[\s-]/g, "").replace(/^PL/i, "");
        return /^\d{26}$/.test(cleaned);
      },
      "Numer rachunku musi mieć 26 cyfr (NRB) lub format IBAN PL"
    ),
  defaultCategoryId: z.string().cuid().optional().nullable(),
});

export const contractorUpdateSchema = contractorCreateSchema.partial();

// ===================================================
// TYP DOKUMENTU
// ===================================================

export const documentTypeCreateSchema = z.object({
  name: z.string().min(1, "Nazwa typu jest wymagana").max(100),
  direction: z.enum(["RECEIVABLE", "PAYABLE"], {
    error: "Kierunek: RECEIVABLE (należność) lub PAYABLE (zobowiązanie)",
  }),
});

// ===================================================
// KATEGORIA
// ===================================================

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Nazwa kategorii jest wymagana").max(100),
  parentId: z.string().cuid().optional().nullable(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// ===================================================
// DOKUMENT (FAKTURA)
// ===================================================

export const documentCreateSchema = z
  .object({
    invoiceNumber: z.string().min(1, "Numer faktury jest wymagany").max(50),
    documentTypeId: z.string().cuid("Nieprawidłowy typ dokumentu"),
    contractorId: z.string().cuid("Nieprawidłowy kontrahent"),
    issueDate: z.coerce.date({ error: "Nieprawidłowa data wystawienia" }),
    dueDate: z.coerce.date({ error: "Nieprawidłowy termin płatności" }),
    amountNet: z.coerce
      .number()
      .min(0, "Kwota netto nie może być ujemna")
      .multipleOf(0.01, "Maksymalnie 2 miejsca dziesiętne"),
    amountVat: z.coerce
      .number()
      .min(0, "Kwota VAT nie może być ujemna")
      .multipleOf(0.01, "Maksymalnie 2 miejsca dziesiętne"),
    amountGross: z.coerce
      .number()
      .min(0, "Kwota brutto nie może być ujemna")
      .multipleOf(0.01, "Maksymalnie 2 miejsca dziesiętne"),
    bankAccountNumber: z.string().optional().nullable(),
    categoryId: z.string().cuid().optional().nullable(),
    source: z.enum(["KSEF", "UPLOAD", "MANUAL"]).default("MANUAL"),
    ksefNumber: z.string().optional().nullable(),
    status: z.enum(["BUFFER", "ACCEPTED"]).default("BUFFER"),
  })
  .refine(
    (data) => data.dueDate >= data.issueDate,
    {
      message: "Termin płatności nie może być wcześniejszy niż data wystawienia",
      path: ["dueDate"],
    }
  )
  .refine(
    (data) => {
      const expectedGross = Math.round((data.amountNet + data.amountVat) * 100) / 100;
      return Math.abs(data.amountGross - expectedGross) < 0.02;
    },
    {
      message: "Kwota brutto musi być równa sumie netto + VAT",
      path: ["amountGross"],
    }
  );

export const documentUpdateSchema = z.object({
  invoiceNumber: z.string().min(1).max(50).optional(),
  documentTypeId: z.string().cuid().optional(),
  contractorId: z.string().cuid().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  amountNet: z.coerce.number().min(0).multipleOf(0.01).optional(),
  amountVat: z.coerce.number().min(0).multipleOf(0.01).optional(),
  amountGross: z.coerce.number().min(0).multipleOf(0.01).optional(),
  bankAccountNumber: z.string().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
});

// ===================================================
// KSeF POBIERANIE
// ===================================================

export const ksefFetchSchema = z
  .object({
    dateFrom: z.coerce.date({ error: "Data od jest wymagana" }),
    dateTo: z.coerce.date({ error: "Data do jest wymagana" }),
    type: z.enum(["COST", "SALES"], {
      error: "Typ: COST (kosztowe) lub SALES (sprzedażowe)",
    }),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: "Data do nie może być wcześniejsza niż data od",
    path: ["dateTo"],
  });

// ===================================================
// AKCEPTACJA Z BUFORA
// ===================================================

export const acceptDocumentsSchema = z.object({
  documentIds: z
    .array(z.string().cuid())
    .min(1, "Wybierz co najmniej jeden dokument do akceptacji"),
});

// ===================================================
// HARMONOGRAM KSeF
// ===================================================

export const ksefScheduleSchema = z.object({
  hour: z.number().int().min(0).max(23, "Godzina: 0-23"),
  minute: z.number().int().min(0).max(59, "Minuta: 0-59").default(0),
  isActive: z.boolean().default(true),
  fetchType: z.enum(["COST", "SALES", "BOTH"]).default("BOTH"),
});

// ===================================================
// KONFIGURACJA KOLUMN
// ===================================================

export const columnConfigUpdateSchema = z.object({
  columns: z.array(
    z.object({
      columnKey: z.string(),
      isVisible: z.boolean(),
      position: z.number().int().min(0),
    })
  ),
});

// ===================================================
// TYPY
// ===================================================

export type ContractorCreate = z.infer<typeof contractorCreateSchema>;
export type DocumentCreate = z.infer<typeof documentCreateSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type KSeFFetchParams = z.infer<typeof ksefFetchSchema>;
export type AcceptDocuments = z.infer<typeof acceptDocumentsSchema>;
export type KSeFScheduleInput = z.infer<typeof ksefScheduleSchema>;
