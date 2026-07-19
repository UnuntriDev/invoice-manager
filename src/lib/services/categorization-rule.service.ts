import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  matchCategorizationRule,
  type RuleMatchInput,
} from "@/lib/category-rules";
import type { CategorizationRuleCreate } from "@/lib/validators/schemas";

export async function listCategorizationRules() {
  return prisma.categorizationRule.findMany({
    include: { category: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function createCategorizationRule(data: CategorizationRuleCreate) {
  return prisma.categorizationRule.create({
    data,
    include: { category: true },
  });
}

export async function updateCategorizationRule(
  id: string,
  data: Partial<CategorizationRuleCreate>,
) {
  return prisma.categorizationRule.update({
    where: { id },
    data,
    include: { category: true },
  });
}

export async function deleteCategorizationRule(id: string) {
  return prisma.categorizationRule.delete({ where: { id } });
}

type RuleClient = Pick<Prisma.TransactionClient, "categorizationRule">;

/**
 * Kategoria dla dokumentu wg reguł słów kluczowych — używana tylko wtedy,
 * gdy kontrahent nie ma domyślnej kategorii. Przyjmuje klienta transakcji,
 * żeby działać spójnie wewnątrz transakcji importu KSeF/uploadu.
 */
export async function resolveCategoryFromRules(
  client: RuleClient,
  input: RuleMatchInput,
): Promise<string | null> {
  const rules = await client.categorizationRule.findMany({
    where: { isActive: true },
  });
  return matchCategorizationRule(rules, input);
}
