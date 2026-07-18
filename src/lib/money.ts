import Decimal from "decimal.js";

export const MAX_MONEY = new Decimal("9999999999.99");

export function parseMoney(value: string): Decimal {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Kwota musi być nieujemną liczbą z maksymalnie 2 miejscami po przecinku");
  }

  const decimal = new Decimal(normalized);
  if (decimal.greaterThan(MAX_MONEY)) {
    throw new Error("Kwota przekracza maksymalną dozwoloną wartość");
  }

  return decimal;
}

export function normalizeMoney(value: string): string {
  return parseMoney(value).toFixed(2);
}

export function addMoney(left: string, right: string): string {
  return parseMoney(left).plus(parseMoney(right)).toFixed(2);
}

export function parsePercentage(value: string): Decimal {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Stawka VAT musi być liczbą od 0 do 100 z maksymalnie 2 miejscami po przecinku");
  }

  const percentage = new Decimal(normalized);
  if (percentage.greaterThan(100)) {
    throw new Error("Stawka VAT nie może przekraczać 100%");
  }
  return percentage;
}

export function calculateVatAmount(amountNet: string, vatRate: string): string {
  return parseMoney(amountNet)
    .times(parsePercentage(vatRate))
    .dividedBy(100)
    .toDecimalPlaces(2)
    .toFixed(2);
}

export function calculateGrossFromRate(amountNet: string, vatRate: string): string {
  return addMoney(amountNet, calculateVatAmount(amountNet, vatRate));
}

export function inferVatRate(amountNet: string, amountVat: string): string {
  const net = parseMoney(amountNet);
  const vat = parseMoney(amountVat);
  if (net.isZero()) {
    if (vat.isZero()) return "0";
    throw new Error("Nie można wyznaczyć stawki VAT dla zerowej kwoty netto");
  }

  return vat.dividedBy(net).times(100).toDecimalPlaces(2).toString();
}

const vatRateFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 2,
});

export function formatVatRate(amountNet: string, amountVat: string): string {
  try {
    return `${vatRateFormatter.format(Number(inferVatRate(amountNet, amountVat)))}%`;
  } catch {
    return "—";
  }
}

export function isGrossEqualToNetAndVat(
  amountNet: string,
  amountVat: string,
  amountGross: string
): boolean {
  try {
    return parseMoney(amountNet).plus(parseMoney(amountVat)).equals(parseMoney(amountGross));
  } catch {
    return false;
  }
}

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

export function formatCurrency(value: string): string {
  return plnFormatter.format(parseMoney(value).toNumber());
}

export { Decimal };
