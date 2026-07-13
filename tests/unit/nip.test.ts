import { validateNip, formatNip } from "@/lib/validators/nip";

describe("validateNip", () => {
  it("accepts valid NIP: 5261040828", () => {
    expect(validateNip("5261040828")).toEqual({ valid: true });
  });

  it("accepts valid NIP: 1132191233", () => {
    expect(validateNip("1132191233")).toEqual({ valid: true });
  });

  it("accepts valid NIP with spaces and dashes", () => {
    expect(validateNip("526-104-08-28")).toEqual({ valid: true });
    expect(validateNip("526 104 08 28")).toEqual({ valid: true });
  });

  it("rejects too short NIP", () => {
    const result = validateNip("12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("10 cyfr");
  });

  it("rejects too long NIP", () => {
    const result = validateNip("12345678901");
    expect(result.valid).toBe(false);
  });

  it("rejects NIP with letters", () => {
    const result = validateNip("521300000A");
    expect(result.valid).toBe(false);
  });

  it("rejects NIP with invalid checksum", () => {
    const result = validateNip("5213000001");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cyfra kontrolna");
  });

  it("rejects NIP where remainder is 10", () => {
    const result = validateNip("5213000000");
    expect(result.valid).toBe(false);
  });

  it("rejects empty string", () => {
    const result = validateNip("");
    expect(result.valid).toBe(false);
  });
});

describe("formatNip", () => {
  it("formats NIP with dashes", () => {
    expect(formatNip("5261040828")).toBe("526-104-08-28");
  });

  it("cleans and formats NIP with spaces", () => {
    expect(formatNip("526 104 08 28")).toBe("526-104-08-28");
  });
});
