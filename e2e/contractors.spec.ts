import { test, expect } from "@playwright/test";
import { validNip, uniqueSuffix, E2E_PREFIX } from "./helpers/data";

test.describe("Kontrahenci", () => {
  test("dodaje, edytuje i usuwa kontrahenta (pełny cykl)", async ({ page }) => {
    const name = `${E2E_PREFIX} Kontrahent ${uniqueSuffix()}`;
    const editedName = `${name} (edytowany)`;

    await page.goto("/contractors");

    // Dodawanie
    await page.getByRole("button", { name: "Dodaj kontrahenta" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#contractor-name").fill(name);
    await dialog.locator("#contractor-nip").fill(validNip());
    await dialog.getByRole("button", { name: "Dodaj", exact: true }).click();

    await expect(page.getByText("Kontrahent dodany")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    // Edycja
    await page.getByRole("button", { name: `Edytuj kontrahenta ${name}` }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.locator("#contractor-name").fill(editedName);
    await editDialog.getByRole("button", { name: "Zapisz zmiany" }).click();
    await expect(page.getByText("Kontrahent zaktualizowany")).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(editedName.replace(/[()]/g, "\\$&")) }),
    ).toBeVisible();

    // Usuwanie (sprzątanie)
    await page
      .getByRole("button", { name: `Usuń kontrahenta ${editedName}` })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Usuń" }).click();
    await expect(page.getByText("Kontrahent usunięty")).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(editedName.replace(/[()]/g, "\\$&")) }),
    ).toHaveCount(0);
  });

  test("odrzuca kontrahenta z nieprawidłowym NIP", async ({ page }) => {
    await page.goto("/contractors");
    await page.getByRole("button", { name: "Dodaj kontrahenta" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#contractor-name").fill(`${E2E_PREFIX} Zła firma`);
    await dialog.locator("#contractor-nip").fill("1234567890"); // niepoprawna cyfra kontrolna
    await dialog.getByRole("button", { name: "Dodaj", exact: true }).click();

    await expect(page.getByText("Nieprawidłowy NIP", { exact: true })).toBeVisible();
    // Dialog pozostaje otwarty — rekord nie został utworzony
    await expect(dialog).toBeVisible();
  });
});
