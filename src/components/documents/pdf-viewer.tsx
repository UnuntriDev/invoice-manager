"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PdfViewer({ documentId }: { documentId: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Pomniejsz podgląd PDF"
            title="Pomniejsz"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="min-w-[4rem] text-center text-sm">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Powiększ podgląd PDF"
            title="Powiększ"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.25))}
            disabled={scale >= 2.0}
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {numPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label="Poprzednia strona PDF"
              title="Poprzednia strona"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="min-w-[6rem] text-center text-sm">
              Strona {pageNumber} z {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Następna strona PDF"
              title="Następna strona"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-auto rounded-md border bg-muted/30">
        <Document
          file={`/api/documents/${documentId}/file`}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
              Ładowanie PDF...
            </div>
          }
          error={
            <div className="flex h-96 items-center justify-center text-sm text-destructive">
              Nie udało się załadować pliku PDF
            </div>
          }
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  );
}
