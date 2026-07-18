const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/** Generuje poprawny NIP z prawidłową cyfrą kontrolną (10 cyfr, bez formatowania). */
export function validNip(): string {
  for (;;) {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const remainder =
      NIP_WEIGHTS.reduce((sum, weight, i) => sum + weight * digits[i], 0) % 11;
    if (remainder === 10) continue;
    return [...digits, remainder].join("");
  }
}

/** Unikalny sufiks do nazw rekordów testowych, żeby uniknąć kolizji i ułatwić sprzątanie. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)
    .toString(36)
    .padStart(3, "0")}`;
}

/** Prefiks oznaczający dane utworzone przez testy E2E. */
export const E2E_PREFIX = "E2E";
