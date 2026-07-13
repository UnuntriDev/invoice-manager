export function validateBankAccount(
  account: string
): { valid: boolean; error?: string } {
  const cleaned = account.replace(/\s/g, "").toUpperCase();

  let digits: string;

  if (/^PL\d{26}$/.test(cleaned)) {
    digits = cleaned;
  } else if (/^\d{26}$/.test(cleaned)) {
    digits = "PL" + cleaned;
  } else {
    return {
      valid: false,
      error: "Numer rachunku musi mieć 26 cyfr (NRB) lub format IBAN (PL + 26 cyfr)",
    };
  }

  const rearranged = digits.slice(4) + digits.slice(0, 4);

  const numericString = rearranged
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return (code - 55).toString();
      }
      return char;
    })
    .join("");

  const remainder = BigInt(numericString) % 97n;

  if (remainder !== 1n) {
    return { valid: false, error: "Nieprawidłowa suma kontrolna numeru rachunku" };
  }

  return { valid: true };
}

export function formatBankAccount(account: string): string {
  const cleaned = account.replace(/[\s-]/g, "").replace(/^PL/i, "");
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4 $5 $6 $7");
}
