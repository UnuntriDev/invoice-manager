const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

export function validateNip(nip: string): { valid: boolean; error?: string } {
  const cleaned = nip.replace(/[\s-]/g, "");

  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "NIP musi składać się z dokładnie 10 cyfr" };
  }

  const digits = cleaned.split("").map(Number);
  const checksum = NIP_WEIGHTS.reduce(
    (sum, weight, i) => sum + weight * digits[i],
    0
  );
  const remainder = checksum % 11;

  if (remainder === 10) {
    return { valid: false, error: "Nieprawidłowa cyfra kontrolna NIP" };
  }

  if (remainder !== digits[9]) {
    return { valid: false, error: "Nieprawidłowa cyfra kontrolna NIP" };
  }

  return { valid: true };
}

export function formatNip(nip: string): string {
  const cleaned = nip.replace(/[\s-]/g, "");
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8, 10)}`;
}
