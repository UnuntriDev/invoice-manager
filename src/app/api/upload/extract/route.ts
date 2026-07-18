import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors/validation-errors";
import { extractPdfInvoiceData } from "@/lib/services/pdf-extraction.service";
import { readBoundedFormData } from "@/lib/http/bounded-form-data";
import {
  getMaxUploadSizeBytes,
  MAX_MULTIPART_OVERHEAD_BYTES,
} from "@/lib/validators/upload";
import { validateUploadBuffer } from "@/lib/validators/upload-content";

export async function POST(request: NextRequest) {
  try {
    const maxFileSize = getMaxUploadSizeBytes();
    const formData = await readBoundedFormData(
      request,
      maxFileSize + MAX_MULTIPART_OVERHEAD_BYTES,
    );
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError("Nie przesłano pliku PDF");
    const buffer = Buffer.from(await file.arrayBuffer());
    let validation: ReturnType<typeof validateUploadBuffer>;
    try {
      validation = validateUploadBuffer(file, buffer, maxFileSize);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Nieprawidłowy plik PDF",
      );
    }
    if (validation.kind !== "pdf") {
      throw new ValidationError(
        "Automatyczny odczyt obsługuje wyłącznie pliki PDF",
      );
    }

    const result = await extractPdfInvoiceData(buffer);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
