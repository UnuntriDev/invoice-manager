import { validateBankAccount, formatBankAccount } from "@/lib/validators/iban";

describe("validateBankAccount", () => {
  it("accepts valid NRB (26 digits)", () => {
    expect(validateBankAccount("61109010140000071219812874")).toEqual({ valid: true });
  });

  it("accepts valid IBAN with PL prefix", () => {
    expect(validateBankAccount("PL61109010140000071219812874")).toEqual({ valid: true });
  });

  it("accepts account with spaces", () => {
    expect(validateBankAccount("61 1090 1014 0000 0712 1981 2874")).toEqual({ valid: true });
  });

  it("rejects too short account", () => {
    const result = validateBankAccount("12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("26 cyfr");
  });

  it("rejects account with invalid checksum", () => {
    const result = validateBankAccount("11109010140000071219812874");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("suma kontrolna");
  });

  it("rejects empty string", () => {
    const result = validateBankAccount("");
    expect(result.valid).toBe(false);
  });

  it("handles lowercase PL prefix", () => {
    expect(validateBankAccount("pl61109010140000071219812874")).toEqual({ valid: true });
  });
});

describe("formatBankAccount", () => {
  it("formats 26-digit account with spaces", () => {
    const formatted = formatBankAccount("61109010140000071219812874");
    expect(formatted).toBe("61 1090 1014 0000 0712 1981 2874");
  });

  it("strips PL prefix before formatting", () => {
    const formatted = formatBankAccount("PL61109010140000071219812874");
    expect(formatted).toBe("61 1090 1014 0000 0712 1981 2874");
  });
});
