export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "text/xml",
  "application/xml",
] as const;

export function getUploadFileValidationError(file: {
  size: number;
  type: string;
}): string | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return "Plik jest za duży. Maksymalny rozmiar to 10MB";
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(
    file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]
  )) {
    return "Dozwolone formaty to PDF i XML";
  }

  return null;
}
