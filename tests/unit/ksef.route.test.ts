const mockFetchFromKSeF = jest.fn();

jest.mock("@/lib/services/ksef.service", () => ({
  fetchFromKSeF: mockFetchFromKSeF,
}));

import type { NextRequest } from "next/server";
import { POST } from "@/app/api/ksef/fetch/route";

function requestWithBody(body: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/ksef/fetch", () => {
  it("returns the required error shape for invalid input", async () => {
    const response = await POST(
      requestWithBody({
        dateFrom: "2026-07-31",
        dateTo: "2026-07-01",
        type: "COST",
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Data do nie może być wcześniejsza niż data od",
    });
    expect(mockFetchFromKSeF).not.toHaveBeenCalled();
  });

  it("returns the same error shape for malformed JSON", async () => {
    const request = {
      json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON")),
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Nieprawidłowy format JSON",
    });
  });

  it("preserves the error shape returned by the import service", async () => {
    mockFetchFromKSeF.mockResolvedValue({
      success: false,
      error: "Nie udało się zapisać dokumentów z KSeF. Żadne dane nie zostały zapisane.",
    });

    const response = await POST(
      requestWithBody({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        type: "COST",
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Nie udało się zapisać dokumentów z KSeF. Żadne dane nie zostały zapisane.",
    });
  });

  it("uses the same error shape when the KSeF connection fails", async () => {
    mockFetchFromKSeF.mockResolvedValue({
      success: false,
      error: "Nie udało się połączyć z KSeF. Spróbuj ponownie.",
    });

    const response = await POST(
      requestWithBody({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        type: "COST",
      })
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      success: false,
      error: "Nie udało się połączyć z KSeF. Spróbuj ponownie.",
    });
  });

  it("uses the same error shape for unexpected route errors", async () => {
    mockFetchFromKSeF.mockRejectedValue(new Error("unexpected"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      requestWithBody({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        type: "SALES",
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Wystąpił błąd serwera",
    });
    consoleError.mockRestore();
  });
});
