import * as bufferService from "@/lib/services/buffer.service";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const documents = await bufferService.listBufferDocuments();
    return successResponse(documents);
  } catch (error) {
    return errorResponse(error);
  }
}
