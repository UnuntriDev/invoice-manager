// Dopasowanie reguł auto-kategoryzacji po słowach kluczowych.
// Reguła "kontrahent → kategoria" (defaultCategoryId) ma zawsze pierwszeństwo;
// ten matcher jest używany dopiero, gdy kontrahent nie ma domyślnej kategorii.

export type RuleMatchField = "contractorName" | "invoiceNumber" | "description";

export interface MatchableRule {
  pattern: string;
  matchField: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
}

export type RuleMatchInput = Partial<Record<RuleMatchField, string | null>>;

export const ruleMatchFieldLabels: Record<RuleMatchField, string> = {
  contractorName: "Nazwa kontrahenta",
  invoiceNumber: "Numer dokumentu",
  description: "Opis dokumentu",
};

/**
 * Zwraca categoryId pierwszej pasującej aktywnej reguły albo null.
 * Kolejność: wyższy priorytet wygrywa; przy równym priorytecie dłuższy
 * (bardziej specyficzny) wzorzec. Dopasowanie: substring bez rozróżniania
 * wielkości liter w polu wskazanym przez matchField.
 */
export function matchCategorizationRule(
  rules: MatchableRule[],
  input: RuleMatchInput,
): string | null {
  const ordered = rules
    .filter((rule) => rule.isActive && rule.pattern.trim().length > 0)
    .sort(
      (a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length,
    );

  for (const rule of ordered) {
    const haystack = input[rule.matchField as RuleMatchField];
    if (!haystack) continue;
    if (haystack.toLowerCase().includes(rule.pattern.trim().toLowerCase())) {
      return rule.categoryId;
    }
  }
  return null;
}
