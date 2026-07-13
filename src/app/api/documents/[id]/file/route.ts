import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as documentService from "@/lib/services/document.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await documentService.getDocument(id);

    if (!document) {
      return NextResponse.json({ error: "Nie znaleziono dokumentu" }, { status: 404 });
    }

    if (!document.filePath) {
      return NextResponse.json({ error: "Dokument nie ma załączonego pliku" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(document.filePath);
    const contentType = document.fileType || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${document.fileName || "file"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Wystąpił błąd serwera" }, { status: 500 });
  }
}
