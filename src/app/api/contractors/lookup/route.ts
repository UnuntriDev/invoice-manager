import { NextRequest, NextResponse } from "next/server";
import { validateNip } from "@/lib/validators/nip";
import { validateBankAccount } from "@/lib/validators/iban";
import {
  checkBankAccount,
  lookupNip,
  WhitelistApiError,
} from "@/lib/services/whitelist.service";
import { successResponse } from "@/lib/api-utils";

function whitelistErrorResponse(error: unknown) {
  if (error instanceof WhitelistApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.kind === "not-found" ? 404 : 502 },
    );
  }
  console.error("Unhandled error:", error);
  return NextResponse.json({ error: "Wystąpił błąd serwera" }, { status: 500 });
}

/**
 * GET /api/contractors/lookup?nip=...            → dane podmiotu z białej listy
 * GET /api/contractors/lookup?nip=...&account=...→ weryfikacja rachunku na białej liście
 */
export async function GET(request: NextRequest) {
  const nip = (request.nextUrl.searchParams.get("nip") ?? "").replace(/[\s-]/g, "");
  const nipCheck = validateNip(nip);
  if (!nipCheck.valid) {
    return NextResponse.json(
      { error: nipCheck.error ?? "Nieprawidłowy NIP" },
      { status: 400 },
    );
  }

  const accountRaw = request.nextUrl.searchParams.get("account");
  try {
    if (accountRaw !== null) {
      // Endpoint MF przyjmuje 26-cyfrowy NRB bez prefiksu kraju.
      const account = accountRaw.replace(/\s/g, "").replace(/^PL/i, "");
      if (!validateBankAccount(account).valid) {
        return NextResponse.json(
          { error: "Nieprawidłowy numer rachunku bankowego" },
          { status: 400 },
        );
      }
      return successResponse(await checkBankAccount(nip, account));
    }
    return successResponse(await lookupNip(nip));
  } catch (error) {
    return whitelistErrorResponse(error);
  }
}
