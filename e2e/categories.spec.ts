import { test, expect } from "@playwright/test";
import { uniqueSuffix, E2E_PREFIX } from "./helpers/data";

test.describe("Kategorie", () => {
  test("dodaje i usuwa kategorię", async ({ page }) => {
    const name = `${E2E_PREFIX} Kategoria ${uniqueSuffix()}`;

    await page.goto("/settings/categories");

    await page.getByRole("button", { name: "Dodaj kategorię" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#category-name").fill(name);
    await dialog.getByRole("button", { name: "Dodaj", exact: true }).click();

    await expect(page.getByText("Kategoria dodana")).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    // Sprzątanie
    await page.getByRole("button", { name: `Usuń kategorię ${name}` }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Usuń" }).click();
    await expect(page.getByText("Kategoria usunięta")).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
