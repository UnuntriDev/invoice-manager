const mockGetDocument = jest.fn();
const mockReadAttachment = jest.fn();
const mockLogMissingAttachment = jest.fn();

jest.mock("@/lib/services/document.service", () => ({
  getDocument: mockGetDocument,
}));

jest.mock("@/lib/storage/attachment-storage", () => ({
  readAttachment: mockReadAttachment,
}));

jest.mock("@/lib/storage/attachment-logger", () => ({
  logMissingAttachment: mockLogMissingAttachment,
}));

import { GET } from "@/app/api/documents/[id]/file/route";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/documents/[id]/file", () => {
  it("returns 404 and logs a stale file reference when the record exists but the file does not", async () => {
    mockGetDocument.mockResolvedValue({
      id: "doc-1",
      filePath: "C:\\uploads\\missing.pdf",
      fileName: "missing.pdf",
      fileType: "application/pdf",
    });
    mockReadAttachment.mockResolvedValue(null);

    const response = await GET({} as never, {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Plik załącznika nie istnieje",
    });
    expect(mockLogMissingAttachment).toHaveBeenCalledWith(
      "doc-1",
      "C:\\uploads\\missing.pdf"
    );
  });
});
