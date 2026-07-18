import { XMLParser } from "fast-xml-parser";
import { Decimal, normalizeMoney } from "@/lib/money";

export interface ParsedInvoice {
  schemaVersion: number;
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  dueDate?: string;
  currency: string;
  seller: {
    nip: string;
    name: string;
    address?: string;
  };
  buyer: {
    nip: string;
    name: string;
    address?: string;
  };
  lineItems: Array<{
    lineNumber: number;
    description: string;
    unit?: string;
    quantity: number;
    unitPriceNet: string;
    amountNet: string;
    vatRate: number;
  }>;
  amountNet: string;
  amountVat: string;
  amountGross: string;
  bankAccountNumber?: string;
}

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: true,
  trimValues: true,
  numberParseOptions: {
    leadingZeros: false,
    hex: false,
    eNotation: false,
    skipLike: /^\d{10,}$/,
  },
  isArray: (name: string) => {
    return name === "FaWiersz";
  },
  processEntities: false,
  maxNestedTags: 100,
};

export const MAX_KSEF_XML_CHARACTERS = 2_000_000;

export function assertSafeKSeFXml(xmlString: string): void {
  if (xmlString.length === 0) {
    throw new Error("Plik XML jest pusty");
  }
  if (xmlString.length > MAX_KSEF_XML_CHARACTERS) {
    throw new Error("Plik XML przekracza bezpieczny limit 2 000 000 znaków");
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xmlString)) {
    throw new Error("Deklaracje DTD i encje XML nie są dozwolone");
  }
}

export function parseKSeFXml(xmlString: string): ParsedInvoice {
  assertSafeKSeFXml(xmlString);
  const parser = new XMLParser(parserOptions);
  const parsed = parser.parse(xmlString, true);

  const faktura = parsed.Faktura;
  if (!faktura) {
    throw new Error("Nieprawidłowy format XML: brak elementu głównego 'Faktura'");
  }

  const naglowek = faktura.Naglowek;
  const schemaVersion = naglowek?.WariantFormularza || 2;

  const podmiot1 = faktura.Podmiot1;
  if (!podmiot1) {
    throw new Error("Brak danych sprzedawcy (Podmiot1)");
  }

  const seller = extractParty(podmiot1);

  const podmiot2 = faktura.Podmiot2;
  if (!podmiot2) {
    throw new Error("Brak danych nabywcy (Podmiot2)");
  }

  const buyer = extractParty(podmiot2);

  const fa = faktura.Fa;
  if (!fa) {
    throw new Error("Brak danych faktury (Fa)");
  }

  const invoiceNumber = String(fa.P_2 || "");
  const issueDate = String(fa.P_1 || "");
  const saleDate = String(fa.P_6 || issueDate);
  const currency = String(fa.KodWaluty || "PLN");

  let dueDate: string | undefined;
  if (fa.Platnosc?.TerminPlatnosci?.Termin) {
    dueDate = String(fa.Platnosc.TerminPlatnosci.Termin);
  }

  let bankAccountNumber: string | undefined;
  if (fa.Platnosc?.RachunekBankowy?.NrRB) {
    bankAccountNumber = String(fa.Platnosc.RachunekBankowy.NrRB);
  }

  const faWiersze = fa.FaWiersze;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Wynik parsera XML ma dynamiczny kształt zależny od wariantu FA.
  const rawItems: any[] = faWiersze?.FaWiersz || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Elementy FA(2)/FA(3) nie mają wspólnego typu generowanego ze schematu.
  const lineItems = rawItems.map((item: any) => ({
    lineNumber: Number(item.NrWiersza || 0),
    description: String(item.P_7 || ""),
    unit: item.P_8A ? String(item.P_8A) : undefined,
    quantity: Number(item.P_8B || 0),
    unitPriceNet: normalizeMoney(String(item.P_9A || "0")),
    amountNet: normalizeMoney(String(item.P_11 || item.P_11A || "0")),
    vatRate: Number(item.P_12 || 0),
  }));

  const podsumowanie = fa.Podsumowanie || {};
  let amountNet = new Decimal(0);
  let amountVat = new Decimal(0);

  for (let i = 1; i <= 11; i++) {
    const netKey = `P_13_${i}`;
    const vatKey = `P_14_${i}`;
    if (podsumowanie[netKey]) {
      amountNet = amountNet.plus(String(podsumowanie[netKey]));
    }
    if (podsumowanie[vatKey]) {
      amountVat = amountVat.plus(String(podsumowanie[vatKey]));
    }
  }

  if (lineItems.length > 0 && (amountNet.isZero() || amountVat.isZero())) {
    if (amountNet.isZero()) {
      amountNet = lineItems.reduce(
        (sum, item) => sum.plus(item.amountNet),
        new Decimal(0)
      );
    }
    if (amountVat.isZero()) {
      amountVat = lineItems.reduce((sum, item) => {
        return sum.plus(
          new Decimal(item.amountNet)
            .times(String(item.vatRate))
            .dividedBy(100)
            .toDecimalPlaces(2)
        );
      }, new Decimal(0));
    }
  }

  const amountGross = amountNet.plus(amountVat);

  return {
    schemaVersion,
    invoiceNumber,
    issueDate,
    saleDate,
    dueDate,
    currency,
    seller,
    buyer,
    lineItems,
    amountNet: amountNet.toFixed(2),
    amountVat: amountVat.toFixed(2),
    amountGross: amountGross.toFixed(2),
    bankAccountNumber,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Struktura Podmiot różni się między wariantami dokumentu XML.
function extractParty(podmiot: any): { nip: string; name: string; address?: string } {
  const dane = podmiot.DaneIdentyfikacyjne || {};
  const adres = podmiot.Adres || {};

  const nip = String(dane.NIP || "");
  const name = dane.Nazwa
    ? String(dane.Nazwa)
    : dane.ImiePierwsze
      ? `${dane.ImiePierwsze || ""} ${dane.Nazwisko || ""}`.trim()
      : "";

  let address: string | undefined;
  if (adres.AdresL1 || adres.AdresL2) {
    address = [adres.AdresL1, adres.AdresL2].filter(Boolean).join(", ");
  } else if (adres.Ulica || adres.Miejscowosc) {
    const parts = [
      adres.Ulica,
      adres.NrDomu,
      adres.NrLokalu ? `/${adres.NrLokalu}` : "",
      adres.KodPocztowy,
      adres.Miejscowosc,
    ].filter(Boolean);
    address = parts.join(" ");
  }

  return { nip, name: String(name || "Nieznany"), address };
}

export function isKSeFXml(content: string): boolean {
  try {
    parseKSeFXml(content);
    return true;
  } catch {
    return false;
  }
}
