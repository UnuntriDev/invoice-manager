import { readFileSync } from "fs";
import path from "path";
import { z } from "zod";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260719010000_add_required_system_document_types",
  "migration.sql",
);
const idCorrectionMigrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260719013000_fix_system_document_type_ids",
  "migration.sql",
);

describe("required system document types migration", () => {
  const migration = readFileSync(migrationPath, "utf8");

  it.each([
    ["Faktura sprzedażowa", "RECEIVABLE"],
    ["Faktura kosztowa", "PAYABLE"],
  ])("creates %s as a system type", (name, direction) => {
    expect(migration).toContain(`'${name}'`);
    expect(migration).toContain(`'${direction}'`);
    expect(migration).toContain('"isSystem"');
  });

  it("is safe when a document type with the same name already exists", () => {
    expect(migration).toContain('ON CONFLICT ("name") DO UPDATE');
    expect(migration).toContain('"isSystem" = true');
  });
});

describe("system document type identifier correction", () => {
  const migration = readFileSync(idCorrectionMigrationPath, "utf8");

  it("uses valid CUID identifiers accepted by document forms", () => {
    const identifiers = [...migration.matchAll(/SET "id" = '([^']+)'/g)].map(
      ([, identifier]) => identifier,
    );

    expect(identifiers).toHaveLength(2);
    expect(new Set(identifiers).size).toBe(2);
    for (const identifier of identifiers) {
      expect(z.string().cuid().safeParse(identifier).success).toBe(true);
    }
  });

  it.each(["Faktura sprzedażowa", "Faktura kosztowa"])(
    "corrects the identifier of %s",
    (name) => {
      expect(migration).toContain(`"name" = '${name}'`);
    },
  );
});
