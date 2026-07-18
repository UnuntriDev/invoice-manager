import { test, expect } from "@playwright/test";
import { uniqueSuffix, E2E_PREFIX } from "./helpers/data";

test.describe("Dokumenty", () => {
  test("dodaje dokument i usuwa go z rejestru", async ({ page }) => {
    const invoiceNumber = `${E2E_PREFIX}/${uniqueSuffix()}`;

    await page.goto("/documents");

    // Otwórz formularz dodawania (Sheet)
    await page.getByRole("button", { name: "Dodaj dokument" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    await sheet.locator("#document-invoice-number").fill(invoiceNumber);

    // Typ dokumentu — wybór z listy (seedowany "Faktura kosztowa")
    await sheet.locator("#document-type").click();
    await page.getByRole("option", { name: "Faktura kosztowa" }).click();
    await expect(page.getByRole("option", { name: "Faktura kosztowa" })).toHaveCount(0);

    // Kontrahent — wybór pierwszej dostępnej opcji
    await sheet.locator("#document-contractor").click();
    const contractorOption = page.getByRole("option").first();
    await expect(contractorOption).toBeVisible();
    await contractorOption.click();
    await expect(page.getByRole("option")).toHaveCount(0);

    // Termin płatności (data wystawienia ma domyślnie dzisiejszą datę)
    await sheet.locator("#document-due-date").fill("31.12.2026");

    // Kwoty
    await sheet.locator("#document-amount-net").fill("1000");
    await sheet.locator("#document-vat-rate").fill("23");

    await sheet.getByRole("button", { name: "Dodaj dokument" }).click();

    await expect(page.getByText("Dokument dodany do rejestru")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(invoiceNumber.replace(/\//g, "\\/")) });
    await expect(row).toBeVisible();

    // Sprzątanie — menu akcji w wierszu → Usuń → potwierdzenie
    await page
      .getByRole("button", { name: `Akcje dokumentu ${invoiceNumber}` })
      .click();
    await page.getByRole("menuitem", { name: "Usuń" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Usuń dokument" }).click();

    await expect(page.getByText(new RegExp(`Usunięto dokument`))).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(invoiceNumber.replace(/\//g, "\\/")) }),
    ).toHaveCount(0);
  });
});
