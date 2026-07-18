import { readFileSync } from "fs";
import path from "path";
import {
  isValidPdfBuffer,
  validateUploadBuffer,
} from "@/lib/validators/upload-content";
import { readBoundedFormData } from "@/lib/http/bounded-form-data";

const xml = Buffer.from(
  readFileSync(path.join(__dirname, "../../docs/sample-fa3.xml"), "utf8"),
);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");

it("accepts a PDF only when magic bytes and EOF marker are present", () => {
  expect(isValidPdfBuffer(pdf)).toBe(true);
  expect(
    validateUploadBuffer(
      { size: pdf.length, type: "application/pdf", name: "invoice.pdf" },
      pdf,
    ),
  ).toEqual({ kind: "pdf" });
});

it("rejects spoofed PDF MIME carrying XML", () => {
  expect(() =>
    validateUploadBuffer(
      { size: xml.length, type: "application/pdf", name: "invoice.pdf" },
      xml,
    ),
  ).toThrow("nie zgadza się z zawartością");
});

it("rejects a damaged PDF with a valid MIME declaration", () => {
  const damaged = Buffer.from("this is not a PDF", "ascii");
  expect(() =>
    validateUploadBuffer(
      {
        size: damaged.length,
        type: "application/pdf",
        name: "invoice.pdf",
      },
      damaged,
    ),
  ).toThrow("uszkodzony");
});

it("rejects multipart from Content-Length before reading its body", async () => {
  const getReader = jest.fn(() => {
    throw new Error("body should not be read");
  });
  const request = {
    url: "http://localhost/api/upload",
    method: "POST",
    headers: new Headers({
      "content-length": "1000",
      "content-type": "multipart/form-data; boundary=test",
    }),
    body: { getReader },
  } as unknown as Request;

  await expect(readBoundedFormData(request, 100)).rejects.toThrow(
    "przekracza dozwolony rozmiar",
  );
  expect(getReader).not.toHaveBeenCalled();
});
