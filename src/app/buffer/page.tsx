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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileX,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  useBufferDocuments,
  useAcceptDocuments,
} from "@/lib/hooks/use-documents";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentFormSheet } from "@/components/documents/document-form";
import {
  sourceBadge,
  type DocumentRow,
} from "@/components/documents/document-columns";
import { KSeFetchPanel } from "@/components/buffer/ksef-fetch-panel";
import { UploadPanel } from "@/components/buffer/upload-panel";
import { formatCurrency } from "@/lib/money";
import { formatDocumentDate as formatDate } from "@/lib/dates";
import { useNotifications } from "@/components/notification-context";

export default function BufferPage() {
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([
    null,
  ]);
  const cursor = cursorHistory.at(-1) ?? null;
  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBufferDocuments(cursor ? { cursor } : {});
  const acceptDocs = useAcceptDocuments();
  const { add: addNotification } = useNotifications();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [editDoc, setEditDoc] = useState<DocumentRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const docs: DocumentRow[] = page?.items ?? [];

  const allSelected =
    docs.length > 0 && docs.every((document) => selected.has(document.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((current) => {
        const next = new Set(current);
        for (const document of docs) next.delete(document.id);
        return next;
      });
    } else {
      setSelected((current) => {
        const next = new Set(current);
        for (const document of docs) next.add(document.id);
        return next;
      });
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
      addNotification({ title: `Zaakceptowano ${result.accepted} dokumentów`, description: "Przeniesiono z bufora do rejestru" });
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd akceptacji");
    }
  }

  async function acceptOne(id: string) {
    try {
      const result = await acceptDocs.mutateAsync([id]);
      toast.success(`Zaakceptowano ${result.accepted} dokument`);
      addNotification({ title: "Zaakceptowano dokument", description: "Przeniesiono z bufora do rejestru" });
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
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Bufor dokumentów</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Dokumenty oczekujące na akceptację
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <KSeFetchPanel />
          <UploadPanel />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-muted-foreground" aria-live="polite">
          {docs.length} dokumentów w buforze · Zaznaczono: {selected.size}
        </p>
        <Button
          onClick={acceptSelected}
          disabled={selected.size === 0 || acceptDocs.isPending}
          className="min-h-11 w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:min-h-8 sm:w-auto"
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
      ) : isError ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center"
          role="alert"
        >
          <AlertTriangle className="mb-3 size-10 text-destructive" aria-hidden="true" />
          <h3 className="font-semibold">Nie udało się pobrać bufora</h3>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Spróbuj ponownie."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RotateCcw aria-hidden="true" />
            Spróbuj ponownie
          </Button>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileX className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Bufor jest pusty</h3>
          <p className="text-sm">Pobierz faktury z KSeF lub wgraj pliki</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden" aria-label="Dokumenty w buforze">
            {docs.map((doc) => (
              <article
                key={doc.id}
                className="rounded-xl border border-border bg-card p-4 dark:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={selected.has(doc.id)}
                      aria-label={`Zaznacz dokument ${doc.invoiceNumber}`}
                      onCheckedChange={() => toggleOne(doc.id)}
                    />
                    <span className="truncate font-mono text-sm font-semibold">
                      {doc.invoiceNumber}
                    </span>
                  </label>
                  <Badge
                    variant="outline"
                    className={sourceBadge[doc.source]?.className}
                  >
                    {sourceBadge[doc.source]?.label || doc.source}
                  </Badge>
                </div>

                <p className="mt-2 truncate text-sm font-medium">{doc.contractor.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {doc.documentType.name}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Data wystawienia</dt>
                    <dd className="mt-1 text-sm font-medium tabular-nums">
                      {formatDate(doc.issueDate)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted-foreground">Termin</dt>
                    <dd className="mt-1 text-sm font-medium tabular-nums">
                      {formatDate(doc.dueDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Netto</dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums">
                      {formatCurrency(doc.amountNet)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted-foreground">Brutto</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(doc.amountGross)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye aria-hidden="true" />
                    Podgląd
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11"
                    onClick={() => acceptOne(doc.id)}
                    disabled={acceptDocs.isPending}
                  >
                    <Check aria-hidden="true" />
                    Akceptuj
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border dark:border-white/15 md:block [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3">
          <Table className="min-w-[900px]" aria-label="Dokumenty w buforze">
            <TableHeader className="bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-foreground/80">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    aria-label="Zaznacz wszystkie dokumenty"
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
                <TableHead className="sticky right-0 z-20 w-24 bg-muted text-center">
                  Akcje
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="group transition-colors even:bg-muted/50 hover:bg-muted"
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(doc.id)}
                      aria-label={`Zaznacz dokument ${doc.invoiceNumber}`}
                      onCheckedChange={() => toggleOne(doc.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{doc.invoiceNumber}</TableCell>
                  <TableCell>{doc.documentType.name}</TableCell>
                  <TableCell>{doc.contractor.name}</TableCell>
                  <TableCell>{formatDate(doc.issueDate)}</TableCell>
                  <TableCell>{formatDate(doc.dueDate)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(doc.amountNet)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {formatCurrency(doc.amountGross)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={sourceBadge[doc.source]?.className}
                    >
                      {sourceBadge[doc.source]?.label || doc.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card group-even:bg-muted group-hover:bg-muted">
                    <TooltipProvider>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-primary"
                                aria-label={`Podgląd dokumentu ${doc.invoiceNumber}`}
                                onClick={() => setPreviewDoc(doc)}
                              />
                            }
                          >
                            <Eye className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent>Podgląd</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:text-primary"
                                aria-label={`Akceptuj dokument ${doc.invoiceNumber}`}
                                onClick={() => acceptOne(doc.id)}
                                disabled={acceptDocs.isPending}
                              />
                            }
                          >
                            <Check className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Akceptuj</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </>
      )}

      {!isLoading && !isError && (cursorHistory.length > 1 || page?.nextCursor) && (
        <nav
          className="flex items-center justify-end gap-2"
          aria-label="Paginacja bufora"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 sm:h-7"
            disabled={cursorHistory.length === 1 || isFetching}
            onClick={() =>
              setCursorHistory((history) => history.slice(0, -1))
            }
          >
            <ChevronLeft aria-hidden="true" />
            Poprzednia
          </Button>
          <span className="text-sm text-muted-foreground">
            Strona {cursorHistory.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 sm:h-7"
            disabled={!page?.nextCursor || isFetching}
            onClick={() =>
              page?.nextCursor &&
              setCursorHistory((history) => [...history, page.nextCursor])
            }
          >
            Następna
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}

      <DocumentPreview
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onEdit={(document) => {
          setEditDoc(document);
          setFormOpen(true);
        }}
        document={previewDoc}
      />

      <DocumentFormSheet
        key={editDoc?.id ?? "new-document"}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditDoc(null);
        }}
        editDocument={editDoc}
      />
    </div>
  );
}
