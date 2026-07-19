import { z } from "zod";
import { validateBankAccount } from "@/lib/validators/iban";
import { validateNip } from "@/lib/validators/nip";
import {
  isGrossEqualToNetAndVat,
  normalizeMoney,
  parseMoney,
} from "@/lib/money";

const cuidSchema = z.string().cuid("Nieprawidłowy identyfikator");

export const nipSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => validateNip(value).valid, {
    message: "Nieprawidłowy NIP",
  });

export const bankAccountSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || validateBankAccount(value).valid, {
    message: "Nieprawidłowy numer IBAN/NRB",
  })
  .optional()
  .nullable()
  .transform((value) =>
    (value ?? "").replace(/[\s-]/g, "").replace(/^PL/i, "")
  );

export const moneySchema = z
  .string({ error: "Kwota jest wymagana" })
  .trim()
  .min(1, "Kwota jest wymagana")
  .superRefine((value, ctx) => {
    try {
      parseMoney(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Nieprawidłowa kwota",
      });
    }
  })
  .transform(normalizeMoney);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data musi mieć format YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Nieprawidłowa data");

// --- KONTRAHENT ---

export const contractorCreateSchema = z.object({
  name: z.string().trim().min(1, "Nazwa kontrahenta jest wymagana").max(255),
  nip: nipSchema,
  address: z.string().max(500).optional().nullable(),
  bankAccountNumber: bankAccountSchema,
  defaultCategoryId: cuidSchema.optional().nullable(),
});

export const contractorUpdateSchema = contractorCreateSchema.partial();

// --- TYP DOKUMENTU ---

export const documentTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Nazwa typu jest wymagana").max(100),
  direction: z.enum(["RECEIVABLE", "PAYABLE"], {
    error: "Kierunek: RECEIVABLE (należność) lub PAYABLE (zobowiązanie)",
  }),
});

export const documentTypeUpdateSchema = documentTypeCreateSchema.pick({
  name: true,
});

// --- KATEGORIA ---

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Nazwa kategorii jest wymagana").max(100),
  parentId: cuidSchema.optional().nullable(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// --- REGUŁA AUTO-KATEGORYZACJI ---

export const categorizationRuleCreateSchema = z.object({
  pattern: z
    .string()
    .trim()
    .min(2, "Słowo kluczowe musi mieć co najmniej 2 znaki")
    .max(100),
  matchField: z.enum(["contractorName", "invoiceNumber", "description"], {
    error: "Nieprawidłowe pole dopasowania reguły",
  }),
  categoryId: cuidSchema,
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export const categorizationRuleUpdateSchema =
  categorizationRuleCreateSchema.partial();

export type CategorizationRuleCreate = z.infer<
  typeof categorizationRuleCreateSchema
>;

// --- DOKUMENT ---

const documentFormFields = {
  invoiceNumber: z.string().trim().min(1, "Numer faktury jest wymagany").max(50),
  documentTypeId: cuidSchema,
  contractorId: cuidSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  amountNet: moneySchema,
  amountVat: moneySchema,
  amountGross: moneySchema,
  bankAccountNumber: bankAccountSchema,
  categoryId: cuidSchema.optional().nullable(),
};

function validateDocumentValues(
  data: {
    issueDate: string;
    dueDate: string;
    amountNet: string;
    amountVat: string;
    amountGross: string;
  },
  ctx: z.RefinementCtx
) {
  const issueDate = isoDateSchema.safeParse(data.issueDate);
  const dueDate = isoDateSchema.safeParse(data.dueDate);

  if (!issueDate.success) {
    ctx.addIssue({ code: "custom", path: ["issueDate"], message: "Nieprawidłowa data wystawienia" });
  }
  if (!dueDate.success) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Nieprawidłowy termin płatności" });
  }
  if (issueDate.success && dueDate.success && data.dueDate < data.issueDate) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Termin płatności nie może być wcześniejszy niż data wystawienia",
    });
  }
  if (!isGrossEqualToNetAndVat(data.amountNet, data.amountVat, data.amountGross)) {
    ctx.addIssue({
      code: "custom",
      path: ["amountGross"],
      message: "Kwota brutto musi być równa sumie netto + VAT",
    });
  }
}

export const documentFormSchema = z
  .object(documentFormFields)
  .superRefine(validateDocumentValues);

// .strictObject() blokuje pola systemowe (source, status, ksefNumber)
export const manualDocumentCreateSchema = z
  .strictObject(documentFormFields)
  .superRefine(validateDocumentValues);

export const documentCreateSchema = z
  .object({
    ...documentFormFields,
    source: z.enum(["KSEF", "UPLOAD", "MANUAL"]).default("MANUAL"),
    ksefNumber: z.string().trim().min(1).max(128).optional().nullable(),
    status: z.enum(["BUFFER", "ACCEPTED"]).default("BUFFER"),
  })
  .superRefine(validateDocumentValues);

export const documentUpdateSchema = documentFormSchema;

export const pdfUploadSchema = documentFormSchema;

export const documentListQuerySchema = z
  .object({
    documentTypeId: cuidSchema.optional(),
    contractorId: cuidSchema.optional(),
    categoryId: cuidSchema.optional(),
    source: z.enum(["KSEF", "UPLOAD", "MANUAL"]).optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    dueDateFrom: isoDateSchema.optional(),
    dueDateTo: isoDateSchema.optional(),
    sortBy: z.enum(["issueDate", "dueDate"]).default("issueDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().max(100).optional(),
    cursor: cuidSchema.optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateTo < data.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "Data do nie może być wcześniejsza niż data od",
      });
    }
    if (
      data.dueDateFrom &&
      data.dueDateTo &&
      data.dueDateTo < data.dueDateFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDateTo"],
        message: "Termin do nie może być wcześniejszy niż termin od",
      });
    }
  });

export const bufferListQuerySchema = z
  .object({
    cursor: cuidSchema.optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// --- KSeF POBIERANIE ---

export const ksefFetchSchema = z
  .object({
    dateFrom: isoDateSchema.transform(
      (value) => new Date(`${value}T00:00:00.000Z`)
    ),
    dateTo: isoDateSchema.transform(
      (value) => new Date(`${value}T00:00:00.000Z`)
    ),
    type: z.enum(["COST", "SALES"], {
      error: "Typ: COST (kosztowe) lub SALES (sprzedażowe)",
    }),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: "Data do nie może być wcześniejsza niż data od",
    path: ["dateTo"],
  });

const ksefPartySchema = z.object({
  nip: nipSchema,
  name: z.string().trim().min(1, "Nazwa kontrahenta jest wymagana").max(255),
  address: z.string().max(500).optional(),
  countryCode: z.string().length(2).optional(),
});

const ksefLineItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  description: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceNet: moneySchema,
  amountNet: moneySchema,
  vatRate: z.number().nonnegative(),
});

export const ksefInvoiceSchema = z
  .object({
    ksefNumber: z.string().trim().min(1, "Numer KSeF jest wymagany").max(128),
    invoiceNumber: z.string().trim().min(1, "Numer faktury jest wymagany").max(50),
    issueDate: isoDateSchema,
    saleDate: isoDateSchema,
    dueDate: isoDateSchema,
    currency: z.string().length(3),
    seller: ksefPartySchema,
    buyer: ksefPartySchema,
    lineItems: z.array(ksefLineItemSchema),
    amountNet: moneySchema,
    amountVat: moneySchema,
    amountGross: moneySchema,
    bankAccountNumber: bankAccountSchema.optional(),
    xmlContent: z.string().min(1, "Treść XML jest wymagana"),
  })
  .refine((invoice) => invoice.dueDate >= invoice.issueDate, {
    message: "Termin płatności nie może być wcześniejszy niż data wystawienia",
    path: ["dueDate"],
  })
  .refine(
    (invoice) =>
      isGrossEqualToNetAndVat(
        invoice.amountNet,
        invoice.amountVat,
        invoice.amountGross
      ),
    {
      message: "Kwota brutto musi być równa sumie netto i VAT",
      path: ["amountGross"],
    }
  );

export const ksefInvoiceBatchSchema = z
  .array(ksefInvoiceSchema)
  .max(1_000, "Batch KSeF może zawierać maksymalnie 1000 dokumentów");

// --- AKCEPTACJA Z BUFORA ---

export const acceptDocumentsSchema = z.object({
  documentIds: z
    .array(z.string().cuid())
    .min(1, "Wybierz co najmniej jeden dokument do akceptacji")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Lista dokumentów zawiera powtórzone identyfikatory",
    }),
});

// --- HARMONOGRAM KSeF ---

export const ksefScheduleSchema = z.object({
  hour: z.number().int().min(0).max(23, "Godzina: 0-23"),
  minute: z.number().int().min(0).max(59, "Minuta: 0-59").default(0),
  isActive: z.boolean().default(true),
  fetchType: z.enum(["COST", "SALES", "BOTH"]).default("BOTH"),
});

// --- KONFIGURACJA KOLUMN ---

export const columnConfigUpdateSchema = z.object({
  columns: z.array(
    z.object({
      columnKey: z.string(),
      isVisible: z.boolean(),
      position: z.number().int().min(0),
    })
  ),
});

// --- TYPY ---

export type ContractorCreate = z.infer<typeof contractorCreateSchema>;
export type ManualDocumentCreate = z.infer<typeof manualDocumentCreateSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type BufferListQuery = z.infer<typeof bufferListQuerySchema>;
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type KSeFFetchParams = z.infer<typeof ksefFetchSchema>;
