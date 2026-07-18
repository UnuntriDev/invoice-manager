export const ROOT_CATEGORY_SCOPE = "__root__";

export function normalizeCategoryName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("pl-PL");
}

export function getCategoryParentScope(parentId: string | null | undefined) {
  return parentId ?? ROOT_CATEGORY_SCOPE;
}
