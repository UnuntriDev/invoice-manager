const mockGetDocument = jest.fn();

jest.mock("@/lib/services/document.service", () => ({
  getDocument: mockGetDocument,
}));

import { GET } from "@/app/api/documents/[id]/route";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/documents/[id]", () => {
  it("returns 404 when the document does not exist", async () => {
    const documentId = "cm12345678901234567890123";
    mockGetDocument.mockResolvedValue(null);

    const response = await GET({} as never, {
      params: Promise.resolve({ id: documentId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Nie znaleziono rekordu",
    });
    expect(mockGetDocument).toHaveBeenCalledWith(documentId);
  });

  it("returns 400 for an invalid identifier without querying the database", async () => {
    const response = await GET({} as never, {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(400);
    expect(mockGetDocument).not.toHaveBeenCalled();
  });
});
