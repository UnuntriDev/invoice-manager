import {
  checkBankAccount,
  lookupNip,
  WhitelistApiError,
} from "@/lib/services/whitelist.service";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

describe("whitelist.service", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("lookupNip", () => {
    it("mapuje dane podmiotu z odpowiedzi API", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          result: {
            subject: {
              name: "CukroPol S.A.",
              workingAddress: "ul. Słodka 1, 00-001 Warszawa",
              accountNumbers: ["12345678901234567890123456"],
              statusVat: "Czynny",
            },
          },
        }),
      );

      const subject = await lookupNip("5260250274");

      expect(subject).toEqual({
        name: "CukroPol S.A.",
        address: "ul. Słodka 1, 00-001 Warszawa",
        accountNumbers: ["12345678901234567890123456"],
        statusVat: "Czynny",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(
          /^https:\/\/wl-api\.mf\.gov\.pl\/api\/search\/nip\/5260250274\?date=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.any(Object),
      );
    });

    it("używa residenceAddress, gdy brak workingAddress", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          result: {
            subject: { name: "Jan Kowalski", residenceAddress: "ul. Polna 2" },
          },
        }),
      );

      const subject = await lookupNip("5260250274");
      expect(subject.address).toBe("ul. Polna 2");
      expect(subject.accountNumbers).toEqual([]);
    });

    it("rzuca not-found, gdy podmiot nie istnieje w wykazie", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ result: { subject: null } }));

      await expect(lookupNip("5260250274")).rejects.toMatchObject({
        name: "WhitelistApiError",
        kind: "not-found",
      });
    });

    it("rzuca unavailable przy odpowiedzi HTTP z błędem (np. limit dzienny)", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}, false));

      await expect(lookupNip("5260250274")).rejects.toMatchObject({
        kind: "unavailable",
      });
    });

    it("rzuca unavailable przy błędzie sieci", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));

      await expect(lookupNip("5260250274")).rejects.toBeInstanceOf(
        WhitelistApiError,
      );
    });
  });

  describe("checkBankAccount", () => {
    it("zwraca assigned=true dla odpowiedzi TAK", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          result: { accountAssigned: "TAK", requestId: "abc-123" },
        }),
      );

      const result = await checkBankAccount(
        "5260250274",
        "12345678901234567890123456",
      );

      expect(result).toEqual({ assigned: true, requestId: "abc-123" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/check/nip/5260250274/bank-account/12345678901234567890123456?date=",
        ),
        expect.any(Object),
      );
    });

    it("zwraca assigned=false dla odpowiedzi NIE", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ result: { accountAssigned: "NIE", requestId: "x" } }),
      );

      const result = await checkBankAccount(
        "5260250274",
        "12345678901234567890123456",
      );
      expect(result.assigned).toBe(false);
    });
  });
});
