// Integracja z publicznym API wykazu podatników VAT ("biała lista") Ministerstwa Finansów.
// https://wl-api.mf.gov.pl — nie wymaga klucza; limit ok. 100 zapytań/dobę na IP w trybie pojedynczym.

const API_BASE = "https://wl-api.mf.gov.pl/api";
const TIMEOUT_MS = 10_000;

export class WhitelistApiError extends Error {
  constructor(
    message: string,
    readonly kind: "not-found" | "unavailable",
  ) {
    super(message);
    this.name = "WhitelistApiError";
  }
}

export interface WhitelistSubject {
  name: string;
  address: string | null;
  accountNumbers: string[];
  statusVat: string | null;
}

export interface AccountCheckResult {
  assigned: boolean;
  requestId: string | null;
}

interface MfSubject {
  name?: string;
  workingAddress?: string | null;
  residenceAddress?: string | null;
  accountNumbers?: string[] | null;
  statusVat?: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchMf(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new WhitelistApiError(
      "Nie udało się połączyć z wykazem podatników VAT. Spróbuj ponownie później.",
      "unavailable",
    );
  }

  if (!response.ok) {
    // API MF zwraca 400 m.in. dla przekroczonego limitu dziennego zapytań.
    throw new WhitelistApiError(
      "Wykaz podatników VAT odrzucił zapytanie (możliwy limit dzienny API). Spróbuj ponownie później.",
      "unavailable",
    );
  }

  return response.json();
}

/** Pobiera dane podmiotu z wykazu podatników VAT po numerze NIP (10 cyfr, bez separatorów). */
export async function lookupNip(nip: string): Promise<WhitelistSubject> {
  const payload = (await fetchMf(`/search/nip/${nip}?date=${todayIso()}`)) as {
    result?: { subject?: MfSubject | null };
  };

  const subject = payload.result?.subject;
  if (!subject?.name) {
    throw new WhitelistApiError(
      "Nie znaleziono podmiotu o podanym NIP w wykazie podatników VAT.",
      "not-found",
    );
  }

  return {
    name: subject.name,
    address: subject.workingAddress ?? subject.residenceAddress ?? null,
    accountNumbers: subject.accountNumbers ?? [],
    statusVat: subject.statusVat ?? null,
  };
}

/**
 * Weryfikuje przypisanie rachunku do podmiotu przez dedykowany endpoint wykazu.
 * W odróżnieniu od porównania z listą rachunków obsługuje też rachunki wirtualne.
 */
export async function checkBankAccount(
  nip: string,
  account: string,
): Promise<AccountCheckResult> {
  const payload = (await fetchMf(
    `/check/nip/${nip}/bank-account/${account}?date=${todayIso()}`,
  )) as {
    result?: { accountAssigned?: string; requestId?: string };
  };

  return {
    assigned: payload.result?.accountAssigned === "TAK",
    requestId: payload.result?.requestId ?? null,
  };
}
