export function formatBankAccountNumber(value: string | null): string {
  if (!value) return "—";
  return value.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") ?? value;
}

export function getDocumentEmptyState(hasActiveFilters: boolean) {
  if (hasActiveFilters) {
    return {
      title: "Brak wyników",
      description:
        "Żaden dokument nie odpowiada aktywnym filtrom. Zmień kryteria lub wyczyść filtry.",
      actionLabel: "Wyczyść filtry",
    } as const;
  }

  return {
    title: "Brak dokumentów",
    description:
      "Dodaj pierwszy dokument lub pobierz z KSeF.",
    actionLabel: "Dodaj dokument",
  } as const;
}
