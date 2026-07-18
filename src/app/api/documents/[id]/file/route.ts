import { NextRequest, NextResponse } from "next/server";
import * as documentService from "@/lib/services/document.service";
import { readAttachment } from "@/lib/storage/attachment-storage";
import { logMissingAttachment } from "@/lib/storage/attachment-logger";
import { validateCuid } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invalid = validateCuid(id);
    if (invalid) return invalid;
    const document = await documentService.getDocumentAttachment(id);

    if (!document) {
      return NextResponse.json({ error: "Nie znaleziono dokumentu" }, { status: 404 });
    }

    if (!document.fileKey) {
      return NextResponse.json({ error: "Dokument nie ma załączonego pliku" }, { status: 404 });
    }

    const fileBuffer = await readAttachment(document.fileKey);
    if (!fileBuffer) {
      logMissingAttachment(id, document.fileKey);
      return NextResponse.json(
        { error: "Plik załącznika nie istnieje" },
        { status: 404 }
      );
    }
    const contentType = document.fileType || "application/octet-stream";
    const fileName = (document.fileName || "file").replace(/["\r\n]/g, "_");

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[attachment-read-failed]", error);
    return NextResponse.json({ error: "Wystąpił błąd serwera" }, { status: 500 });
  }
}
