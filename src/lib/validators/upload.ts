export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;

export type UploadKind = "pdf" | "xml";

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "text/xml",
  "application/xml",
  "application/octet-stream",
  "",
] as const;

export function getMaxUploadSizeBytes(
  rawValue = process.env.MAX_FILE_SIZE_MB,
): number {
  if (rawValue == null || rawValue.trim() === "") {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }
  const megabytes = Number(rawValue);
  if (!Number.isInteger(megabytes) || megabytes < 1 || megabytes > 100) {
    throw new Error("MAX_FILE_SIZE_MB musi być liczbą całkowitą od 1 do 100");
  }
  return megabytes * 1024 * 1024;
}

export function getUploadFileValidationError(
  file: { size: number; type: string; name?: string },
  maxSizeBytes = DEFAULT_MAX_UPLOAD_SIZE_BYTES,
): string | null {
  if (file.size === 0) return "Plik jest pusty";
  if (file.size > maxSizeBytes) {
    return `Plik jest za duży. Maksymalny rozmiar to ${Math.floor(
      maxSizeBytes / 1024 / 1024,
    )} MB`;
  }
  if (
    !ALLOWED_UPLOAD_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
    )
  ) {
    return "Dozwolone formaty to PDF i XML";
  }
  return null;
}
