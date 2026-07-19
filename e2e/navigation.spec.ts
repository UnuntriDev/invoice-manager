import { test, expect } from "@playwright/test";

test.describe("Nawigacja", () => {
  test("przechodzi między głównymi sekcjami przez sidebar", async ({ page }) => {
    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { name: "Rejestr dokumentów" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Kontrahenci" }).click();
    await expect(page).toHaveURL(/\/contractors$/);
    await expect(
      page.getByRole("heading", { name: "Kontrahenci" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Kategorie" }).click();
    await expect(page).toHaveURL(/\/settings\/categories$/);
    await expect(page.getByRole("heading", { name: "Kategorie" })).toBeVisible();

    await page.getByRole("link", { name: "Typy dokumentów" }).click();
    await expect(page).toHaveURL(/\/settings\/document-types$/);
    await expect(
      page.getByRole("heading", { name: "Typy dokumentów" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Bufor" }).click();
    await expect(page).toHaveURL(/\/buffer$/);
    await expect(
      page.getByRole("heading", { name: "Bufor dokumentów" }),
    ).toBeVisible();
  });

  test("otwiera i zamyka paletę poleceń skrótem Ctrl+K", async ({ page }) => {
    await page.goto("/documents");

    const palette = page.getByRole("dialog", { name: "Przejdź do…" });

    // Kliknięcie triggera potwierdza, że klient został już zhydradowany i
    // listener skrótu klawiaturowego jest podłączony także w pełnym zestawie.
    await page.getByText("Szukaj w aplikacji...", { exact: true }).click();
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible();
  });
});
