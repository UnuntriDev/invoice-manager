import { test, expect } from "@playwright/test";
import { uniqueSuffix, E2E_PREFIX } from "./helpers/data";

test.describe("Typy dokumentów", () => {
  test("dodaje i usuwa typ dokumentu", async ({ page }) => {
    const name = `${E2E_PREFIX} Typ ${uniqueSuffix()}`;

    await page.goto("/settings/document-types");

    await page.getByRole("button", { name: "Dodaj typ" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#document-type-name").fill(name);
    // Kierunek pozostaje domyślny (Zobowiązanie / PAYABLE)
    await dialog.getByRole("button", { name: "Dodaj", exact: true }).click();

    await expect(page.getByText("Typ dokumentu dodany")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    // Sprzątanie
    await page
      .getByRole("button", { name: `Usuń typ dokumentu ${name}` })
      .click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Usuń" }).click();
    await expect(page.getByText("Typ dokumentu usunięty")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  });
});
