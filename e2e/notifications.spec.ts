import { test, expect } from "@playwright/test";
import { uniqueSuffix, E2E_PREFIX } from "./helpers/data";

test.describe("Powiadomienia", () => {
  test("pokazuje powiadomienie po akcji i pozwala je wyczyścić", async ({
    page,
  }) => {
    const name = `${E2E_PREFIX} Powiadomienie ${uniqueSuffix()}`;

    await page.goto("/settings/categories");
    // Wyzeruj stan powiadomień (localStorage) i przeładuj, żeby test był deterministyczny
    await page.evaluate(() => localStorage.removeItem("gj:notifications"));
    await page.reload();

    // Akcja generująca powiadomienie
    await page.getByRole("button", { name: "Dodaj kategorię" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#category-name").fill(name);
    await dialog.getByRole("button", { name: "Dodaj", exact: true }).click();
    await expect(page.getByText("Kategoria dodana")).toBeVisible();

    // Dzwonek ma teraz badge z liczbą nieprzeczytanych
    const bell = page.getByRole("button", { name: /Powiadomienia/ });
    await expect(bell).toHaveAccessibleName(/nieprzeczytan/);

    // Otwórz dropdown i sprawdź treść powiadomienia
    await bell.click();
    await expect(
      page.getByText("Kategoria dodana", { exact: true }).last(),
    ).toBeVisible();

    // Sprzątanie rekordu kategorii (zanim wyczyścimy powiadomienia)
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: `Usuń kategorię ${name}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
    await expect(page.getByText("Kategoria usunięta")).toBeVisible();

    // Wyczyść wszystkie powiadomienia
    await bell.click();
    await page.getByRole("button", { name: "Wyczyść" }).click();
    await expect(page.getByText("Brak powiadomień")).toBeVisible();
  });
});
