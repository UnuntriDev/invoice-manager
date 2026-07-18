import { extractInvoiceFieldsFromLines } from "@/lib/pdf/invoice-text-parser";

describe("PDF invoice text extraction", () => {
  it("extracts common Polish invoice fields without floating-point arithmetic", () => {
    const result = extractInvoiceFieldsFromLines([
      "FAKTURA VAT NR FV/2026/07/123",
      "Data wystawienia: 16.07.2026",
      "Termin płatności: 30.07.2026",
      "NIP: 676-246-45-85",
      "Razem netto: 1 000,10 zł",
      "VAT: 230,02 zł",
      "Do zapłaty: 1 230,12 zł",
    ]);

    expect(result.fields).toEqual({
      invoiceNumber: "FV/2026/07/123",
      issueDate: "2026-07-16",
      dueDate: "2026-07-30",
      amountNet: "1000.10",
      amountVat: "230.02",
      amountGross: "1230.12",
    });
    expect(result.nips).toContain("6762464585");
  });

  it("calculates gross when only net and VAT are present", () => {
    const result = extractInvoiceFieldsFromLines([
      "Nr faktury: 1/2026",
      "Netto: 0,10",
      "VAT: 0,20",
    ]);

    expect(result.fields.amountGross).toBe("0.30");
  });

  it("does not invent fields when labels are absent", () => {
    const result = extractInvoiceFieldsFromLines(["Dowolny dokument bez danych faktury"]);
    expect(result.fields).toEqual({
      invoiceNumber: undefined,
      issueDate: undefined,
      dueDate: undefined,
      amountNet: undefined,
      amountVat: undefined,
      amountGross: undefined,
    });
  });

  it("supports InsERT-style invoice headers, ISO dates and summary rows", () => {
    const result = extractInvoiceFieldsFromLines([
      "Data wystawienia:",
      "2020-03-30",
      "Sprzedawca: Nabywca:",
      "NIP: 111-111-11-11 NIP: 832-65-62-042",
      "Faktura VAT 7/2020 oryginał",
      "Razem: 2 970,00 237,60 3 207,60",
    ]);

    expect(result.fields).toEqual({
      invoiceNumber: "7/2020",
      issueDate: "2020-03-30",
      dueDate: undefined,
      amountNet: "2970.00",
      amountVat: "237.60",
      amountGross: "3207.60",
    });
    expect(result.nips).toEqual(["1111111111", "8326562042"]);
  });
});
