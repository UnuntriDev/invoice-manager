import { errorResponse } from "@/lib/api-utils";

describe("API error mapping", () => {
  it("maps malformed JSON to HTTP 400", async () => {
    const response = errorResponse(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Nieprawidłowy JSON w treści żądania",
    });
  });

  it.each(["P2002", "P2003", "P2034"])(
    "maps Prisma conflict %s to HTTP 409",
    async (code) => {
      const response = errorResponse(Object.assign(new Error("conflict"), { code }));
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: expect.any(String),
      });
    },
  );

  it("maps Prisma not found to HTTP 404", () => {
    expect(
      errorResponse(Object.assign(new Error("missing"), { code: "P2025" }))
        .status,
    ).toBe(404);
  });
});
