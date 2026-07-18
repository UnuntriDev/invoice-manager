import { readFileSync } from "fs";
import path from "path";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260719010000_add_required_system_document_types",
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
