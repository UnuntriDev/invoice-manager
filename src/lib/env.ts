import { z } from "zod";
import { validateNip } from "@/lib/validators/nip";

const companyNipSchema = z
  .string({ error: "Brak zmiennej środowiskowej COMPANY_NIP" })
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => validateNip(value).valid, {
    message: "Zmienna COMPANY_NIP nie zawiera poprawnego polskiego NIP-u",
  });

export function getCompanyNip(
  environment?: { COMPANY_NIP?: string },
): string {
  const result = companyNipSchema.safeParse(
    environment?.COMPANY_NIP ?? process.env.COMPANY_NIP,
  );
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Nieprawidłowy COMPANY_NIP");
  }

  return result.data;
}
