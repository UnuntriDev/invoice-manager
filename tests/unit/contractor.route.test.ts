const mockGetContractor = jest.fn();

jest.mock("@/lib/services/contractor.service", () => ({
  getContractor: mockGetContractor,
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/contractors/[id]/route";

describe("GET /api/contractors/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 when the contractor does not exist", async () => {
    mockGetContractor.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/contractors/ca23456789012345678901234"),
      { params: Promise.resolve({ id: "ca23456789012345678901234" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Nie znaleziono rekordu",
    });
  });
});
