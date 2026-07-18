import { isKSeFXml, MAX_KSEF_XML_CHARACTERS } from "@/lib/ksef/xml-parser";
import {
  getMaxUploadSizeBytes,
  getUploadFileValidationError,
  type UploadKind,
} from "@/lib/validators/upload";

function kindFromMime(type: string): UploadKind | null {
  if (type === "application/pdf") return "pdf";
  if (type === "text/xml" || type === "application/xml") return "xml";
  return null;
}

function kindFromName(name?: string): UploadKind | null {
  const lower = name?.toLowerCase() ?? "";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xml")) return "xml";
  return null;
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const header = buffer.subarray(0, 8).toString("latin1");
  if (!/^%PDF-\d\.\d/.test(header)) return false;
  const tail = buffer
    .subarray(Math.max(0, buffer.length - 2_048))
    .toString("latin1");
  return /%%EOF\s*$/.test(tail);
}

function decodeUtf8(buffer: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

export function validateUploadBuffer(
  file: { size: number; type: string; name?: string },
  buffer: Buffer,
  maxSizeBytes = getMaxUploadSizeBytes(),
): { kind: UploadKind; xmlContent?: string } {
  const metadataError = getUploadFileValidationError(file, maxSizeBytes);
  if (metadataError) throw new Error(metadataError);
  if (buffer.length !== file.size || buffer.length === 0) {
    throw new Error("Plik jest pusty lub został przesłany niekompletnie");
  }

  const xmlContent = decodeUtf8(buffer);
  const actualKind: UploadKind | null = isValidPdfBuffer(buffer)
    ? "pdf"
    : xmlContent &&
        xmlContent.length <= MAX_KSEF_XML_CHARACTERS &&
        isKSeFXml(xmlContent)
      ? "xml"
      : null;
  if (!actualKind) {
    throw new Error("Plik jest uszkodzony albo nie jest prawidłowym PDF/XML KSeF");
  }

  const mimeKind = kindFromMime(file.type);
  const extensionKind = kindFromName(file.name);
  if (
    (mimeKind && mimeKind !== actualKind) ||
    (extensionKind && extensionKind !== actualKind)
  ) {
    throw new Error("Typ MIME lub rozszerzenie pliku nie zgadza się z zawartością");
  }

  return actualKind === "xml"
    ? { kind: actualKind, xmlContent: xmlContent! }
    : { kind: actualKind };
}
