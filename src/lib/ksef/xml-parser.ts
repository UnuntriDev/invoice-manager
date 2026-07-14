import { XMLParser } from "fast-xml-parser";

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
    unitPriceNet: number;
    amountNet: number;
    vatRate: number;
  }>;
  amountNet: number;
  amountVat: number;
  amountGross: number;
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
};

export function parseKSeFXml(xmlString: string): ParsedInvoice {
  const parser = new XMLParser(parserOptions);
  const parsed = parser.parse(xmlString);

  const faktura = parsed.Faktura;
  if (!faktura) {
    throw new Error("Nieprawidłowy format XML — brak elementu głównego 'Faktura'");
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = faWiersze?.FaWiersz || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems = rawItems.map((item: any) => ({
    lineNumber: Number(item.NrWiersza || 0),
    description: String(item.P_7 || ""),
    unit: item.P_8A ? String(item.P_8A) : undefined,
    quantity: Number(item.P_8B || 0),
    unitPriceNet: Number(item.P_9A || 0),
    amountNet: Number(item.P_11 || item.P_11A || 0),
    vatRate: Number(item.P_12 || 0),
  }));

  const podsumowanie = fa.Podsumowanie || {};
  let amountNet = 0;
  let amountVat = 0;

  for (let i = 1; i <= 11; i++) {
    const netKey = `P_13_${i}`;
    const vatKey = `P_14_${i}`;
    if (podsumowanie[netKey]) amountNet += Number(podsumowanie[netKey]);
    if (podsumowanie[vatKey]) amountVat += Number(podsumowanie[vatKey]);
  }

  if (lineItems.length > 0 && (amountNet === 0 || amountVat === 0)) {
    if (amountNet === 0) {
      amountNet = lineItems.reduce((sum, item) => sum + item.amountNet, 0);
    }
    if (amountVat === 0) {
      amountVat = lineItems.reduce((sum, item) => {
        return sum + Math.round(item.amountNet * (item.vatRate / 100) * 100) / 100;
      }, 0);
    }
  }

  const amountGross = Math.round((amountNet + amountVat) * 100) / 100;

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
    amountNet: Math.round(amountNet * 100) / 100,
    amountVat: Math.round(amountVat * 100) / 100,
    amountGross,
    bankAccountNumber,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    return (
      content.includes("<Faktura") &&
      (content.includes("Podmiot1") || content.includes("podmiot1")) &&
      (content.includes("<Fa>") || content.includes("<fa>"))
    );
  } catch {
    return false;
  }
}
