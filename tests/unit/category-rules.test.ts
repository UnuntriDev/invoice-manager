import {
  matchCategorizationRule,
  type MatchableRule,
} from "@/lib/category-rules";

function rule(overrides: Partial<MatchableRule>): MatchableRule {
  return {
    pattern: "paliwo",
    matchField: "contractorName",
    categoryId: "cat-1",
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

describe("matchCategorizationRule", () => {
  it("dopasowuje frazę w nazwie kontrahenta bez rozróżniania wielkości liter", () => {
    const rules = [rule({ pattern: "orlen", categoryId: "cat-fuel" })];
    expect(
      matchCategorizationRule(rules, { contractorName: "ORLEN Spółka Akcyjna" }),
    ).toBe("cat-fuel");
  });

  it("dopasowuje frazę w numerze dokumentu", () => {
    const rules = [
      rule({ pattern: "LEASING", matchField: "invoiceNumber", categoryId: "cat-leasing" }),
    ];
    expect(
      matchCategorizationRule(rules, { invoiceNumber: "FV/leasing/2026/07" }),
    ).toBe("cat-leasing");
  });

  it("zwraca null, gdy nic nie pasuje", () => {
    const rules = [rule({ pattern: "paliwo" })];
    expect(
      matchCategorizationRule(rules, { contractorName: "Cukiernia", invoiceNumber: "FV/1" }),
    ).toBeNull();
  });

  it("pomija reguły nieaktywne", () => {
    const rules = [rule({ pattern: "cukiernia", isActive: false })];
    expect(
      matchCategorizationRule(rules, { contractorName: "Cukiernia Słodki Róg" }),
    ).toBeNull();
  });

  it("wyższy priorytet wygrywa niezależnie od kolejności", () => {
    const rules = [
      rule({ pattern: "trans", categoryId: "cat-low", priority: 0 }),
      rule({ pattern: "trans", categoryId: "cat-high", priority: 10 }),
    ];
    expect(
      matchCategorizationRule(rules, { contractorName: "TransChłód" }),
    ).toBe("cat-high");
  });

  it("przy równym priorytecie wygrywa dłuższa fraza", () => {
    const rules = [
      rule({ pattern: "trans", categoryId: "cat-generic" }),
      rule({ pattern: "transchłód", categoryId: "cat-specific" }),
    ];
    expect(
      matchCategorizationRule(rules, { contractorName: "TransChłód Sp. z o.o." }),
    ).toBe("cat-specific");
  });

  it("nie dopasowuje do pola, którego reguła nie wskazuje", () => {
    const rules = [rule({ pattern: "orlen", matchField: "invoiceNumber" })];
    expect(
      matchCategorizationRule(rules, { contractorName: "Orlen S.A.", invoiceNumber: "FV/1" }),
    ).toBeNull();
  });

  it("ignoruje puste wartości wejściowe", () => {
    const rules = [rule({ pattern: "orlen" })];
    expect(
      matchCategorizationRule(rules, { contractorName: null, invoiceNumber: "FV/1" }),
    ).toBeNull();
  });
});
