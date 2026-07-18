"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Pencil,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDocumentDate, formatDocumentDateTime } from "@/lib/dates";
import { parseKSeFXml, type ParsedInvoice } from "@/lib/ksef/xml-parser";
import { Decimal, formatCurrency, parseMoney } from "@/lib/money";
import { useDocument } from "@/lib/hooks/use-documents";
import {
  sourceBadge,
  statusBadge,
  type DocumentDetail,
  type DocumentRow,
} from "./document-columns";

const PdfViewerLazy = dynamic(() => import("./pdf-viewer"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: (document: DocumentRow) => void;
  document: DocumentRow | null;
}


type XmlInvoiceData = Partial<ParsedInvoice>;

function getXmlData(doc: DocumentDetail | DocumentRow): XmlInvoiceData | null {
  if (!("xmlData" in doc) || !doc.xmlData) return null;

  const xmlData = doc.xmlData as { xmlContent?: string } & XmlInvoiceData;
  if (!xmlData.xmlContent) return xmlData;

  try {
    return parseKSeFXml(xmlData.xmlContent);
  } catch {
    return null;
  }
}

function formatOptionalCurrency(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";

  try {
    return formatCurrency(value);
  } catch {
    return "—";
  }
}

function formatLineGross(amountNet: string, vatRate: number): string {
  try {
    const multiplier = new Decimal(1).plus(
      new Decimal(String(vatRate)).dividedBy(100),
    );
    return formatCurrency(
      parseMoney(amountNet).times(multiplier).toDecimalPlaces(2).toFixed(2),
    );
  } catch {
    return "—";
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 py-5 first:pt-0 last:pb-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DataField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "break-all font-mono text-xs font-medium text-foreground"
            : "break-words text-sm font-medium text-foreground"
        }
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function ContractorSection({ doc }: { doc: DocumentRow }) {
  return (
    <Section title="Kontrahent">
      <div className="w-full space-y-1.5">
        <p className="font-semibold text-foreground">{doc.contractor.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          NIP: {doc.contractor.nip}
        </p>
        {doc.contractor.address && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {doc.contractor.address}
          </p>
        )}
      </div>
    </Section>
  );
}

function DocumentDataSection({
  doc,
  xmlData,
}: {
  doc: DocumentRow;
  xmlData: XmlInvoiceData | null;
}) {
  const source = sourceBadge[doc.source] || sourceBadge.MANUAL;

  return (
    <Section title="Dane dokumentu">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <DataField label="Data wystawienia" value={formatDocumentDate(doc.issueDate)} />
        <DataField label="Termin płatności" value={formatDocumentDate(doc.dueDate)} />
        {xmlData?.saleDate && (
          <DataField label="Data sprzedaży" value={formatDocumentDate(xmlData.saleDate)} />
        )}
        <DataField label="Kategoria" value={doc.category?.name || "—"} />
        <DataField label="Źródło" value={source.label} />
        {xmlData?.currency && (
          <DataField label="Waluta" value={xmlData.currency} />
        )}
        <DataField
          label="Numer rachunku"
          value={doc.bankAccountNumber || xmlData?.bankAccountNumber || "—"}
          mono
        />
        <DataField label="Numer KSeF" value={doc.ksefNumber || "—"} mono />
        <DataField
          label="Data utworzenia"
          value={formatDocumentDateTime(doc.createdAt)}
        />
      </dl>
    </Section>
  );
}

function Summary({ doc }: { doc: DocumentRow }) {
  const amounts = [
    { label: "Netto", value: formatOptionalCurrency(doc.amountNet) },
    { label: "VAT", value: formatOptionalCurrency(doc.amountVat) },
    { label: "Brutto", value: formatOptionalCurrency(doc.amountGross) },
  ];

  return (
    <Section title="Podsumowanie">
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-4 ring-1 ring-border/70">
        {amounts.map((amount) => (
          <div key={amount.label} className="min-w-0 text-right">
            <dt className="text-xs text-muted-foreground">{amount.label}</dt>
            <dd
              className={`mt-1 whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base ${
                amount.label === "Brutto" ? "text-primary" : "text-foreground"
              }`}
            >
              {amount.value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function ExpandableItemName({
  description,
  itemNumber,
}: {
  description: string | null | undefined;
  itemNumber: string | number;
}) {
  const [expanded, setExpanded] = useState(false);
  const value = description?.trim() || "—";
  const canExpand = value.length > 36;

  return (
    <div className="min-w-0">
      <p
        className={`hyphens-none break-normal font-medium leading-snug [overflow-wrap:normal] ${
          canExpand && !expanded ? "line-clamp-2" : ""
        }`}
      >
        {value}
      </p>
      {canExpand && (
        <button
          type="button"
          className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Zwiń" : "Rozwiń"} nazwę pozycji ${itemNumber}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Zwiń" : "Rozwiń"}
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

function LineItems({ items }: { items: ParsedInvoice["lineItems"] }) {
  if (items.length === 0) return null;

  return (
    <Section title={`Pozycje (${items.length})`}>
      <div className="space-y-2 sm:hidden">
        {items.map((item, index) => (
          <article
            key={`${item.lineNumber}-${index}-mobile`}
            className="rounded-xl border border-border bg-card p-4 dark:border-white/15"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                {item.lineNumber || index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ExpandableItemName
                  description={item.description}
                  itemNumber={item.lineNumber || index + 1}
                />
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {item.unitPriceNet
                    ? `${formatOptionalCurrency(item.unitPriceNet)} / ${item.unit || "szt."}`
                    : "—"}
                </p>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
              <div>
                <dt className="text-xs text-muted-foreground">Ilość</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums">
                  {item.quantity ?? "—"}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">VAT</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums">
                  {item.vatRate != null ? `${item.vatRate}%` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Netto</dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {formatOptionalCurrency(item.amountNet)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">Brutto</dt>
                <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                  {item.vatRate != null
                    ? formatLineGross(item.amountNet, item.vatRate)
                    : "—"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2">Lp.</TableHead>
              <TableHead className="px-2">Nazwa</TableHead>
              <TableHead className="w-10 px-1 text-right">Ilość</TableHead>
              <TableHead className="w-20 px-1 text-right">Netto</TableHead>
              <TableHead className="w-12 px-2 text-right">VAT (%)</TableHead>
              <TableHead className="w-[5.5rem] px-1 text-right">Brutto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.lineNumber}-${index}`}>
                <TableCell className="px-2 align-top">{item.lineNumber || index + 1}</TableCell>
                <TableCell className="whitespace-normal px-2 align-top">
                  <ExpandableItemName
                    description={item.description}
                    itemNumber={item.lineNumber || index + 1}
                  />
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {item.unitPriceNet
                      ? `${formatOptionalCurrency(item.unitPriceNet)} / ${item.unit || "szt."}`
                      : "—"}
                  </p>
                </TableCell>
                <TableCell className="px-1 text-right align-top tabular-nums">
                  {item.quantity ?? "—"}
                </TableCell>
                <TableCell className="px-2 text-right align-top text-xs tabular-nums">
                  {formatOptionalCurrency(item.amountNet)}
                </TableCell>
                <TableCell className="px-2 text-right align-top tabular-nums">
                  {item.vatRate != null ? `${item.vatRate}%` : "—"}
                </TableCell>
                <TableCell className="px-2 text-right align-top text-xs font-medium tabular-nums">
                  {item.vatRate != null
                    ? formatLineGross(item.amountNet, item.vatRate)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function AttachmentSection({ doc }: { doc: DocumentRow }) {
  if (!doc.fileName) return null;

  return (
    <Section title="Załączniki">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{doc.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {doc.fileType || "Plik dokumentu"}
            </p>
          </div>
        </div>
        <a
          href={`/api/documents/${doc.id}/file`}
          download={doc.fileName}
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "size-11 sm:size-7",
          })}
          aria-label={`Pobierz załącznik ${doc.fileName}`}
          title="Pobierz załącznik"
        >
          <Download aria-hidden="true" />
        </a>
      </div>
    </Section>
  );
}

async function copyToClipboard(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Nie udało się skopiować wartości");
  }
}

function HeaderActions({
  doc,
  onEdit,
}: {
  doc: DocumentRow;
  onEdit: (document: DocumentRow) => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-3">
      <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => onEdit(doc)}>
        <Pencil aria-hidden="true" />
        Edytuj
      </Button>

      {doc.fileName ? (
        <a
          href={`/api/documents/${doc.id}/file`}
          download={doc.fileName}
          className={buttonVariants({
            variant: "outline",
            className: "size-11 p-0 sm:h-8 sm:w-auto sm:px-2.5",
          })}
          aria-label={`Pobierz załącznik ${doc.fileName}`}
        >
          <Download aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Pobierz załącznik</span>
        </a>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="size-11 p-0 sm:h-8 sm:w-auto sm:px-2.5"
          disabled
          aria-label="Pobierz załącznik: brak załącznika"
          title="Brak załącznika"
        >
          <Download aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Pobierz załącznik</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-8"
              aria-label="Więcej akcji dokumentu"
            />
          }
        >
          <Ellipsis aria-hidden="true" />
          Więcej
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() =>
              void copyToClipboard(doc.invoiceNumber, "Skopiowano numer faktury")
            }
          >
            <Copy aria-hidden="true" />
            Kopiuj numer faktury
          </DropdownMenuItem>
          {doc.ksefNumber && (
            <DropdownMenuItem
              onClick={() =>
                void copyToClipboard(doc.ksefNumber!, "Skopiowano numer KSeF")
              }
            >
              <Copy aria-hidden="true" />
              Kopiuj numer KSeF
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DocumentPreview({
  open,
  onClose,
  onEdit,
  document: doc,
}: Props) {
  const detailQuery = useDocument(open && doc ? doc.id : null);
  if (!doc) return null;

  const resolvedDoc = detailQuery.data ?? doc;
  const source = sourceBadge[resolvedDoc.source] || sourceBadge.MANUAL;
  const status = statusBadge[resolvedDoc.status] || statusBadge.BUFFER;
  const xmlData = getXmlData(resolvedDoc);
  const isPdf = Boolean(
    resolvedDoc.fileType?.includes("pdf") && resolvedDoc.fileName,
  );

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:max-w-[480px] data-[side=right]:sm:max-w-[480px]"
        overlayClassName="bg-black/5 supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="sticky top-0 z-20 gap-0 border-b bg-popover/95 px-5 py-3 pr-14 supports-backdrop-filter:backdrop-blur-sm sm:py-4">
          <SheetTitle className="text-lg font-semibold leading-tight">
            Faktura nr {resolvedDoc.invoiceNumber}
          </SheetTitle>
          <SheetDescription className="mt-1">
            {resolvedDoc.documentType.name}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={source.className}>
              {source.label}
            </Badge>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>
          <HeaderActions
            doc={resolvedDoc}
            onEdit={(document) => {
              onClose();
              onEdit(document);
            }}
          />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {detailQuery.isLoading && (
            <div className="space-y-3" aria-label="Ładowanie szczegółów dokumentu">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {detailQuery.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Nie udało się pobrać szczegółów</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detailQuery.error.message}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void detailQuery.refetch()}
                  >
                    <RotateCcw aria-hidden="true" />
                    Spróbuj ponownie
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="divide-y divide-border">
            <ContractorSection doc={resolvedDoc} />
            <DocumentDataSection doc={resolvedDoc} xmlData={xmlData} />
            <Summary doc={resolvedDoc} />
            {xmlData?.lineItems && <LineItems items={xmlData.lineItems} />}
            {isPdf && (
              <Section title="Podgląd załącznika">
                <PdfViewerLazy documentId={resolvedDoc.id} />
              </Section>
            )}
            <AttachmentSection doc={resolvedDoc} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
