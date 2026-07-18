import "dotenv/config";
import { PrismaClient, Prisma } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL jest wymagany do preflightu migracji");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const duplicates = await prisma.$queryRaw<
    Array<{ nameKey: string; parentScope: string; count: number }>
  >(Prisma.sql`
    SELECT
      lower(trim("name")) AS "nameKey",
      coalesce("parentId", '__root__') AS "parentScope",
      count(*)::int AS "count"
    FROM "Category"
    GROUP BY 1, 2
    HAVING count(*) > 1
    ORDER BY 3 DESC, 1 ASC
  `);

  if (duplicates.length > 0) {
    console.error("Wykryto duplikaty kategorii. Migracja nie może być wykonana:");
    console.error(JSON.stringify(duplicates, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("Preflight PASS: brak duplikatów nazw kategorii w tym samym rodzicu.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
