import { addMoney, normalizeMoney } from "@/lib/money";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parsePolishDate(value: string): string | undefined {
  const isoMatch = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const parsed = new Date(`${iso}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
      ? iso
      : undefined;
  }

  const match = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
    ? iso
    : undefined;
}

function parseMoneyValues(value: string): string[] {
  return [...value.matchAll(/\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})/g)]
    .map((match) => parsePolishMoney(match[0]))
    .filter((amount): amount is string => Boolean(amount));
}

function parsePolishMoney(value: string): string | undefined {
  const match = value.match(/(?:PLN|zł)?\s*(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{1,2})|\d+(?:[,.]\d{1,2})?)/i);
  if (!match) return undefined;
  try {
    return normalizeMoney(match[1].replace(/[ .](?=\d{3}(?:\D|$))/g, ""));
  } catch {
    return undefined;
  }
}

function valueAfterLabel(lines: string[], labels: RegExp[]): string | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    for (const label of labels) {
      const sameLine = lines[index].match(label);
      if (!sameLine) continue;
      const remainder = normalizeWhitespace(lines[index].slice((sameLine.index ?? 0) + sameLine[0].length));
      if (remainder) return remainder;
      if (lines[index + 1]) return lines[index + 1];
    }
  }
  return undefined;
}

export function extractInvoiceFieldsFromLines(lines: string[]) {
  const normalized = lines.map(normalizeWhitespace).filter(Boolean);
  const invoiceRaw = valueAfterLabel(normalized, [
    /(?:numer|nr)\s+(?:faktury|dokumentu)\s*[:#-]?\s*/i,
    /faktura(?:\s+vat)?\s+(?:nr|numer)\s*[:#-]?\s*/i,
    /^faktura(?:\s+vat)?\s*[:#-]?\s*/i,
  ]);
  const issueRaw = valueAfterLabel(normalized, [/data\s+wystawienia\s*[:#-]?\s*/i, /wystawiono\s*[:#-]?\s*/i]);
  const dueRaw = valueAfterLabel(normalized, [/termin\s+płatności\s*[:#-]?\s*/i, /płatne\s+do\s*[:#-]?\s*/i]);
  const netRaw = valueAfterLabel(normalized, [/^(?:razem|suma|wartość)?\s*netto\s*[:#-]?\s*/i]);
  const vatRaw = valueAfterLabel(normalized, [/^(?:kwota|suma|razem)?\s*vat\s*[:#-]?\s*/i, /^podatek\s+vat\s*[:#-]?\s*/i]);
  const grossRaw = valueAfterLabel(normalized, [/^(?:razem|suma|wartość|do\s+zapłaty)?\s*brutto\s*[:#-]?\s*/i, /^(?:razem\s+)?do\s+zapłaty\s*[:#-]?\s*/i]);

  let amountNet = netRaw ? parsePolishMoney(netRaw) : undefined;
  let amountVat = vatRaw ? parsePolishMoney(vatRaw) : undefined;
  let amountGross = grossRaw ? parsePolishMoney(grossRaw) : undefined;
  const summaryLine = normalized.find((line) => /^razem\s*:/i.test(line));
  const summaryAmounts = summaryLine ? parseMoneyValues(summaryLine) : [];
  if (summaryAmounts.length >= 3) {
    amountNet ??= summaryAmounts[0];
    amountVat ??= summaryAmounts[1];
    amountGross ??= summaryAmounts[2];
  }
  if (!amountGross && amountNet && amountVat) amountGross = addMoney(amountNet, amountVat);

  const text = normalized.join("\n");
  const nips = Array.from(new Set(
      [...text.matchAll(/NIP\s*[:#-]?\s*([\d -]{10,18})/gi)]
        .map((match) => match[1].replace(/\D/g, ""))
      .filter((nip) => nip.length === 10),
  ));

  return {
    fields: {
      invoiceNumber:
        invoiceRaw
          ?.replace(/^[#: -]+/, "")
          .replace(/\s+(?:oryginał|kopia).*$/i, "")
          .trim()
          .slice(0, 50) || undefined,
      issueDate: issueRaw ? parsePolishDate(issueRaw) : undefined,
      dueDate: dueRaw ? parsePolishDate(dueRaw) : undefined,
      amountNet,
      amountVat,
      amountGross,
    },
    nips,
  };
}
