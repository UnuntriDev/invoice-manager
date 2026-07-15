import {
  formatBankAccountNumber,
  getDocumentEmptyState,
} from "@/lib/document-list-presentation";

describe("document list presentation", () => {
  describe("formatBankAccountNumber", () => {
    it("groups a bank account into readable four-character blocks", () => {
      expect(formatBankAccountNumber("61109010140000071219812874")).toBe(
        "6110 9010 1400 0007 1219 8128 74"
      );
    });

    it("normalizes whitespace before formatting", () => {
      expect(formatBankAccountNumber("61 1090 1014 0000 0712 1981 2874")).toBe(
        "6110 9010 1400 0007 1219 8128 74"
      );
    });

    it("uses a dash for a missing account number", () => {
      expect(formatBankAccountNumber(null)).toBe("—");
    });
  });

  it("distinguishes an empty registry from empty filtered results", () => {
    expect(getDocumentEmptyState(false)).toMatchObject({
      title: "Brak dokumentów",
      actionLabel: "Dodaj dokument",
    });
    expect(getDocumentEmptyState(true)).toMatchObject({
      title: "Brak wyników",
      actionLabel: "Wyczyść filtry",
    });
  });
});
