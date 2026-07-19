import { expect, test, type APIRequestContext } from "@playwright/test";

const KSEF_DATE_DISPLAY = "17.12.2099";
const INVOICE_PREFIX = "FV/2099/12/";
const TARGET_INVOICE = `${INVOICE_PREFIX}001`;

interface DocumentListItem {
  id: string;
  invoiceNumber: string;
}

interface DocumentPageResponse {
  data: {
    items: DocumentListItem[];
    nextCursor: string | null;
  };
}

async function removeTestDocuments(request: APIRequestContext) {
  const documentIds = new Set<string>();

  for (const endpoint of ["/api/buffer", "/api/documents"]) {
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({ pageSize: "100" });
      if (cursor) query.set("cursor", cursor);
      if (endpoint === "/api/documents") query.set("search", INVOICE_PREFIX);

      const response = await request.get(`${endpoint}?${query}`);
      expect(response.ok(), `Nie udało się odczytać ${endpoint} podczas sprzątania`).toBeTruthy();

      const body = (await response.json()) as DocumentPageResponse;
      for (const document of body.data.items) {
        if (document.invoiceNumber.startsWith(INVOICE_PREFIX)) {
          documentIds.add(document.id);
        }
      }
      cursor = body.data.nextCursor;
    } while (cursor);
  }

  for (const id of documentIds) {
    const response = await request.delete(`/api/documents/${id}`);
    expect(response.ok(), `Nie udało się usunąć dokumentu testowego ${id}`).toBeTruthy();
  }
}

test.describe("Pełny obieg dokumentu KSeF", () => {
  test.beforeEach(async ({ request }) => {
    await removeTestDocuments(request);
  });

  test.afterEach(async ({ request }) => {
    await removeTestDocuments(request);
  });

  test("pobiera dokument do bufora, pokazuje podgląd, akceptuje i otwiera go w rejestrze", async ({
    page,
  }) => {
    await page.goto("/buffer");

    await page.getByRole("button", { name: "Pobierz z KSeF" }).click();
    const fetchDialog = page.getByRole("dialog", {
      name: "Pobieranie faktur z KSeF",
    });
    await expect(fetchDialog).toBeVisible();

    await fetchDialog.locator("#ksef-date-from").fill(KSEF_DATE_DISPLAY);
    await fetchDialog.locator("#ksef-date-to").fill(KSEF_DATE_DISPLAY);
    await fetchDialog.getByRole("button", { name: "Pobierz", exact: true }).click();

    await expect(page.getByText("Pobrano 4 faktury do bufora")).toBeVisible();
    for (let index = 1; index <= 4; index += 1) {
      const invoiceNumber = `${INVOICE_PREFIX}${String(index).padStart(3, "0")}`;
      await expect(
        page.getByRole("cell", { name: invoiceNumber, exact: true }),
      ).toBeVisible();
    }

    await page
      .getByRole("button", { name: `Podgląd dokumentu ${TARGET_INVOICE}` })
      .click();

    let preview = page.getByRole("dialog", {
      name: `Faktura nr ${TARGET_INVOICE}`,
    });
    await expect(preview).toBeVisible();
    await expect(
      preview.locator('[data-slot="badge"]').filter({ hasText: /^KSeF$/ }),
    ).toBeVisible();
    await expect(
      preview.locator('[data-slot="badge"]').filter({ hasText: /^Bufor$/ }),
    ).toBeVisible();
    await expect(preview.getByText(/^Pozycje \(\d+\)$/)).toBeVisible();

    await preview.getByRole("button", { name: "Zamknij panel" }).click();
    await expect(preview).toBeHidden();

    await page
      .getByRole("button", { name: `Akceptuj dokument ${TARGET_INVOICE}` })
      .click();
    await expect(page.getByText("Zaakceptowano 1 dokument", { exact: true })).toBeVisible();
    await expect(page.getByText(TARGET_INVOICE, { exact: true })).toHaveCount(0);

    await page.goto("/documents");
    await page
      .getByRole("searchbox", { name: "Szukaj: numer faktury lub kontrahent" })
      .fill(TARGET_INVOICE);

    const registryRow = page.getByRole("row", {
      name: `Otwórz podgląd dokumentu ${TARGET_INVOICE}`,
    });
    await expect(registryRow).toBeVisible();
    await registryRow.press("Enter");

    preview = page.getByRole("dialog", {
      name: `Faktura nr ${TARGET_INVOICE}`,
    });
    await expect(preview).toBeVisible();
    await expect(
      preview.locator('[data-slot="badge"]').filter({ hasText: /^KSeF$/ }),
    ).toBeVisible();
    await expect(
      preview
        .locator('[data-slot="badge"]')
        .filter({ hasText: /^Zaakceptowany$/ }),
    ).toBeVisible();
    await expect(preview.getByText(/^Pozycje \(\d+\)$/)).toBeVisible();
  });
});
