"use client";

import dynamic from "next/dynamic";
import {
  Copy,
  Download,
  Ellipsis,
  FileText,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatCurrency } from "@/lib/money";
import type { DocumentRow } from "./document-columns";

const PdfViewerLazy = dynamic(() => import("./pdf-viewer"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: (document: DocumentRow) => void;
  document: DocumentRow | null;
}

const sourceBadge: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  KSEF: { label: "KSeF", variant: "default" },
  UPLOAD: { label: "Upload", variant: "secondary" },
  MANUAL: { label: "Ręczny", variant: "outline" },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  BUFFER: {
    label: "Bufor",
    className:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  ACCEPTED: {
    label: "Zaakceptowany",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
};

type XmlInvoiceData = Partial<ParsedInvoice>;

function getXmlData(doc: DocumentRow): XmlInvoiceData | null {
  if (!doc.xmlData) return null;

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

function LineItems({ items }: { items: ParsedInvoice["lineItems"] }) {
  if (items.length === 0) return null;

  return (
    <Section title={`Pozycje (${items.length})`}>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Lp.</TableHead>
              <TableHead className="min-w-48">Nazwa</TableHead>
              <TableHead className="text-right">Ilość</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">VAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.lineNumber}-${index}`}>
                <TableCell>{item.lineNumber || index + 1}</TableCell>
                <TableCell>
                  <p className="font-medium">{item.description || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.unitPriceNet
                      ? `${formatOptionalCurrency(item.unitPriceNet)} / ${item.unit || "szt."}`
                      : "—"}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.quantity ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatOptionalCurrency(item.amountNet)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.vatRate != null ? `${item.vatRate}%` : "—"}
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
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
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
    <div className="flex flex-wrap items-center gap-2 pt-3">
      <Button type="button" variant="outline" onClick={() => onEdit(doc)}>
        <Pencil aria-hidden="true" />
        Edytuj
      </Button>

      {doc.fileName ? (
        <a
          href={`/api/documents/${doc.id}/file`}
          download={doc.fileName}
          className={buttonVariants({ variant: "outline" })}
        >
          <Download aria-hidden="true" />
          Pobierz załącznik
        </a>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled
          aria-label="Pobierz załącznik — brak załącznika"
          title="Brak załącznika"
        >
          <Download aria-hidden="true" />
          Pobierz załącznik
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
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
  if (!doc) return null;

  const source = sourceBadge[doc.source] || sourceBadge.MANUAL;
  const status = statusBadge[doc.status] || statusBadge.BUFFER;
  const xmlData = getXmlData(doc);
  const isPdf = Boolean(doc.fileType?.includes("pdf") && doc.fileName);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:max-w-[480px] data-[side=right]:sm:max-w-[480px]"
        overlayClassName="bg-black/5 supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader className="sticky top-0 z-20 gap-0 border-b bg-popover/95 px-5 py-4 pr-14 supports-backdrop-filter:backdrop-blur-sm">
          <SheetTitle className="text-lg font-semibold leading-tight">
            Faktura nr {doc.invoiceNumber}
          </SheetTitle>
          <SheetDescription className="mt-1">
            {doc.documentType.name}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={source.variant}>{source.label}</Badge>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>
          <HeaderActions
            doc={doc}
            onEdit={(document) => {
              onClose();
              onEdit(document);
            }}
          />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="divide-y divide-border">
            <ContractorSection doc={doc} />
            <DocumentDataSection doc={doc} xmlData={xmlData} />
            <Summary doc={doc} />
            {xmlData?.lineItems && <LineItems items={xmlData.lineItems} />}
            {isPdf && (
              <Section title="Podgląd załącznika">
                <PdfViewerLazy documentId={doc.id} />
              </Section>
            )}
            <AttachmentSection doc={doc} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
