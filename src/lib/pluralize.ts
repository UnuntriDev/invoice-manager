/**
 * Polska pluralizacja: wybiera formę liczby mnogiej zależnie od liczby.
 * forms = [mianownik l.poj., l.mn. 2–4, l.mn. dopełniacz]
 * np. pluralizePl(1, ["dokument","dokumenty","dokumentów"]) → "dokument"
 *     pluralizePl(3, [...]) → "dokumenty"
 *     pluralizePl(5, [...]) → "dokumentów"
 */
export function pluralizePl(
  count: number,
  forms: [one: string, few: string, many: string],
): string {
  const n = Math.abs(count);
  if (n === 1) return forms[0];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return forms[1];
  }
  return forms[2];
}

/** Skrót dla najczęstszego przypadku: "N dokument/dokumenty/dokumentów". */
export function documentsLabel(count: number): string {
  return `${count} ${pluralizePl(count, ["dokument", "dokumenty", "dokumentów"])}`;
}
