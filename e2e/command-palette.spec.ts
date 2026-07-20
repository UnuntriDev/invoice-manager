import { test, expect } from "@playwright/test";

test.describe("Paleta poleceń", () => {
  test("nawiguje do strony przez wyszukiwanie", async ({ page }) => {
    await page.goto("/documents");

    await page.getByText("Szukaj w aplikacji...", { exact: true }).click();
    const palette = page.getByRole("dialog", { name: "Przejdź do…" });
    await expect(palette).toBeVisible();

    await palette.getByPlaceholder("Przejdź do…").fill("Kontrahenci");
    await palette.getByRole("button", { name: "Kontrahenci" }).click();

    await expect(page).toHaveURL(/\/contractors$/);
    await expect(
      page.getByRole("heading", { name: "Kontrahenci" }),
    ).toBeVisible();
  });

  test("akcja 'Dodaj kontrahenta' otwiera formularz na właściwej stronie", async ({
    page,
  }) => {
    await page.goto("/documents");

    await page.getByText("Szukaj w aplikacji...", { exact: true }).click();
    const palette = page.getByRole("dialog", { name: "Przejdź do…" });
    await palette.getByPlaceholder("Przejdź do…").fill("Dodaj kontrahenta");
    await palette.getByRole("button", { name: "Dodaj kontrahenta" }).click();

    await expect(page).toHaveURL(/\/contractors/);
    // Formularz dodawania otwiera się automatycznie (parametr ?action=add)
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#contractor-name")).toBeVisible();
  });
});
