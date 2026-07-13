import { NextRequest } from "next/server";
import * as uploadService from "@/lib/services/upload.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse(new uploadService.ValidationError("Nie przesłano pliku"));
    }

    const overrides: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key !== "file" && typeof value === "string") {
        overrides[key] = value;
      }
    }

    const document = await uploadService.handleUpload(file, overrides);
    return successResponse(document, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
