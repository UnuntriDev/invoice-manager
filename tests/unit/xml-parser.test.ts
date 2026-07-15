import { readFileSync } from "fs";
import path from "path";
import { parseKSeFXml, isKSeFXml } from "@/lib/ksef/xml-parser";

const sampleXml = readFileSync(
  path.join(__dirname, "../../docs/sample-fa3.xml"),
  "utf-8"
);

describe("isKSeFXml", () => {
  it("detects valid KSeF XML", () => {
    expect(isKSeFXml(sampleXml)).toBe(true);
  });

  it("rejects plain text", () => {
    expect(isKSeFXml("just some text")).toBe(false);
  });

  it("rejects partial XML without Faktura", () => {
    expect(isKSeFXml("<root><data>test</data></root>")).toBe(false);
  });
});

describe("parseKSeFXml", () => {
  it("parses invoice number", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.invoiceNumber).toBe("FV/2026/07/001");
  });

  it("parses seller data", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.seller.nip).toBe("5213000000");
    expect(result.seller.name).toBe("PackPol Sp. z o.o.");
  });

  it("parses buyer data", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.buyer.nip).toBe("9876543210");
    expect(result.buyer.name).toBe("Gumijagoda Sp. z o.o.");
  });

  it("parses dates", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.issueDate).toBe("2026-07-10");
    expect(result.saleDate).toBe("2026-07-10");
    expect(result.dueDate).toBe("2026-08-09");
  });

  it("parses line items", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.lineItems).toHaveLength(3);
    expect(result.lineItems[0].description).toContain("Opakowania kartonowe");
    expect(result.lineItems[0].quantity).toBe(5);
    expect(result.lineItems[0].unitPriceNet).toBe("1200.00");
    expect(result.lineItems[0].amountNet).toBe("6000.00");
  });

  it("parses amounts from Podsumowanie", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.amountNet).toBe("12500.00");
    expect(result.amountVat).toBe("2875.00");
    expect(result.amountGross).toBe("15375.00");
  });

  it("parses bank account", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.bankAccountNumber).toBe("61109010140000071219812874");
  });

  it("parses schema version", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.schemaVersion).toBe(3);
  });

  it("parses currency", () => {
    const result = parseKSeFXml(sampleXml);
    expect(result.currency).toBe("PLN");
  });

  it("throws on invalid XML", () => {
    expect(() => parseKSeFXml("<root>no faktura</root>")).toThrow("brak elementu głównego");
  });

  it("throws on missing seller", () => {
    const xml = '<?xml version="1.0"?><Faktura><Naglowek/></Faktura>';
    expect(() => parseKSeFXml(xml)).toThrow("Podmiot1");
  });
});
