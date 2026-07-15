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
