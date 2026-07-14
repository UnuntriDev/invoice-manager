"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Check, FileX, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import {
  useBufferDocuments,
  useAcceptDocuments,
} from "@/lib/hooks/use-documents";
import { DocumentPreview } from "@/components/documents/document-preview";
import type { DocumentRow } from "@/components/documents/document-columns";
import { KSeFetchPanel } from "@/components/buffer/ksef-fetch-panel";
import { UploadPanel } from "@/components/buffer/upload-panel";

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(val));
}

function formatDate(val: string) {
  return format(new Date(val), "dd.MM.yyyy", { locale: pl });
}

const sourceBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  KSEF: { label: "KSeF", variant: "default" },
  UPLOAD: { label: "Upload", variant: "secondary" },
  MANUAL: { label: "Ręczny", variant: "outline" },
};

export default function BufferPage() {
  const { data: documents, isLoading } = useBufferDocuments();
  const acceptDocs = useAcceptDocuments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const docs: DocumentRow[] = documents || [];

  const allSelected = docs.length > 0 && selected.size === docs.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(docs.map((d) => d.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function acceptSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const result = await acceptDocs.mutateAsync(ids);
      toast.success(`Zaakceptowano ${result.accepted} dokumentów`);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd akceptacji");
    }
  }

  async function acceptOne(id: string) {
    try {
      const result = await acceptDocs.mutateAsync([id]);
      toast.success(`Zaakceptowano ${result.accepted} dokument`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd akceptacji");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Bufor dokumentów</h1>
        <p className="text-sm text-muted-foreground">
          Dokumenty oczekujące na akceptację
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <KSeFetchPanel />
        <UploadPanel />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} dokumentów w buforze
          {selected.size > 0 && ` · ${selected.size} zaznaczonych`}
        </p>
        <Button
          onClick={acceptSelected}
          disabled={selected.size === 0 || acceptDocs.isPending}
        >
          <Check className="mr-2 h-4 w-4" />
          Akceptuj wybrane ({selected.size})
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileX className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Bufor jest pusty</h3>
          <p className="text-sm">Pobierz faktury z KSeF lub wgraj pliki</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Numer faktury</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kontrahent</TableHead>
                <TableHead>Data wyst.</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead>Źródło</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(doc.id)}
                      onCheckedChange={() => toggleOne(doc.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{doc.invoiceNumber}</TableCell>
                  <TableCell>{doc.documentType.name}</TableCell>
                  <TableCell>{doc.contractor.name}</TableCell>
                  <TableCell>{formatDate(doc.issueDate)}</TableCell>
                  <TableCell>{formatDate(doc.dueDate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(doc.amountNet)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(doc.amountGross)}</TableCell>
                  <TableCell>
                    <Badge variant={sourceBadge[doc.source]?.variant || "outline"}>
                      {sourceBadge[doc.source]?.label || doc.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => acceptOne(doc.id)}
                        disabled={acceptDocs.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocumentPreview
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  );
}
