"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import dynamic from "next/dynamic";
import { XMLParser } from "fast-xml-parser";
import type { DocumentRow } from "./document-columns";

const PdfViewerLazy = dynamic(() => import("./pdf-viewer"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  document: DocumentRow | null;
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(val));
}

function formatDate(val: string) {
  return format(new Date(val), "dd.MM.yyyy", { locale: pl });
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
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  ACCEPTED: {
    label: "Zaakceptowany",
    className: "bg-green-100 text-green-800 border-green-300",
  },
};

function PreviewHeader({ doc }: { doc: DocumentRow }) {
  const src = sourceBadge[doc.source] || sourceBadge.MANUAL;
  const st = statusBadge[doc.status] || statusBadge.BUFFER;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={src.variant}>{src.label}</Badge>
        <Badge variant="outline" className={st.className}>
          {st.label}
        </Badge>
      </div>
      <div>
        <h3 className="text-lg font-semibold">{doc.invoiceNumber}</h3>
        <p className="text-sm text-muted-foreground">
          {doc.documentType.name}
        </p>
      </div>
    </div>
  );
}


interface XmlInvoiceData {
  seller?: { nip?: string; name?: string; address?: string };
  buyer?: { nip?: string; name?: string; address?: string };
  invoiceNumber?: string;
  issueDate?: string;
  saleDate?: string;
  dueDate?: string;
  currency?: string;
  lineItems?: Array<{
    lineNumber?: number;
    description?: string;
    unit?: string;
    quantity?: number;
    unitPriceNet?: number;
    amountNet?: number;
    vatRate?: number;
  }>;
  amountNet?: number;
  amountVat?: number;
  amountGross?: number;
  bankAccountNumber?: string;
}

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: true,
  trimValues: true,
  numberParseOptions: { leadingZeros: false, hex: false, eNotation: false, skipLike: /^\d{10,}$/ },
  isArray: (name: string) => name === "FaWiersz",
};

function parseXmlContent(xmlString: string): XmlInvoiceData {
  const parser = new XMLParser(xmlParserOptions);
  const parsed = parser.parse(xmlString);
  const faktura = parsed.Faktura;
  if (!faktura) return {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractParty = (podmiot: any) => {
    const dane = podmiot?.DaneIdentyfikacyjne || {};
    const adres = podmiot?.Adres || {};
    const nip = String(dane.NIP || "");
    const name = dane.Nazwa ? String(dane.Nazwa) : dane.ImiePierwsze ? `${dane.ImiePierwsze || ""} ${dane.Nazwisko || ""}`.trim() : "";
    let address: string | undefined;
    if (adres.AdresL1 || adres.AdresL2) {
      address = [adres.AdresL1, adres.AdresL2].filter(Boolean).join(", ");
    } else if (adres.Ulica || adres.Miejscowosc) {
      address = [adres.Ulica, adres.NrDomu, adres.NrLokalu ? `/${adres.NrLokalu}` : "", adres.KodPocztowy, adres.Miejscowosc].filter(Boolean).join(" ");
    }
    return { nip, name: String(name || "Nieznany"), address };
  };

  const fa = faktura.Fa || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = fa.FaWiersze?.FaWiersz || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems = rawItems.map((item: any) => ({
    lineNumber: Number(item.NrWiersza || 0),
    description: String(item.P_7 || ""),
    unit: item.P_8A ? String(item.P_8A) : undefined,
    quantity: Number(item.P_8B || 0),
    unitPriceNet: Number(item.P_9A || 0),
    amountNet: Number(item.P_11 || item.P_11A || 0),
    vatRate: Number(item.P_12 || 0),
  }));

  const podsumowanie = fa.Podsumowanie || {};
  let amountNet = 0;
  let amountVat = 0;
  for (let i = 1; i <= 11; i++) {
    if (podsumowanie[`P_13_${i}`]) amountNet += Number(podsumowanie[`P_13_${i}`]);
    if (podsumowanie[`P_14_${i}`]) amountVat += Number(podsumowanie[`P_14_${i}`]);
  }
  if (lineItems.length > 0 && amountNet === 0) amountNet = lineItems.reduce((s, i) => s + i.amountNet, 0);
  if (lineItems.length > 0 && amountVat === 0) amountVat = lineItems.reduce((s, i) => s + Math.round(i.amountNet * (i.vatRate / 100) * 100) / 100, 0);

  return {
    seller: faktura.Podmiot1 ? extractParty(faktura.Podmiot1) : undefined,
    buyer: faktura.Podmiot2 ? extractParty(faktura.Podmiot2) : undefined,
    invoiceNumber: fa.P_2 ? String(fa.P_2) : undefined,
    issueDate: fa.P_1 ? String(fa.P_1) : undefined,
    saleDate: fa.P_6 ? String(fa.P_6 || fa.P_1) : undefined,
    dueDate: fa.Platnosc?.TerminPlatnosci?.Termin ? String(fa.Platnosc.TerminPlatnosci.Termin) : undefined,
    currency: String(fa.KodWaluty || "PLN"),
    lineItems,
    amountNet: Math.round(amountNet * 100) / 100,
    amountVat: Math.round(amountVat * 100) / 100,
    amountGross: Math.round((amountNet + amountVat) * 100) / 100,
    bankAccountNumber: fa.Platnosc?.RachunekBankowy?.NrRB ? String(fa.Platnosc.RachunekBankowy.NrRB) : undefined,
  };
}

function PartyCard({
  title,
  party,
}: {
  title: string;
  party: { nip?: string; name?: string; address?: string };
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-semibold">{party.name || "—"}</p>
        {party.nip && (
          <p className="font-mono text-muted-foreground">NIP: {party.nip}</p>
        )}
        {party.address && <p className="text-muted-foreground">{party.address}</p>}
      </CardContent>
    </Card>
  );
}

function XmlPreview({ data }: { data: XmlInvoiceData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {data.seller && <PartyCard title="Sprzedawca" party={data.seller} />}
        {data.buyer && <PartyCard title="Nabywca" party={data.buyer} />}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Dane faktury
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Numer</span>
              <p className="font-medium">{data.invoiceNumber || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Waluta</span>
              <p className="font-medium">{data.currency || "PLN"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data wystawienia</span>
              <p className="font-medium">
                {data.issueDate ? formatDate(data.issueDate) : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Data sprzedaży</span>
              <p className="font-medium">
                {data.saleDate ? formatDate(data.saleDate) : "—"}
              </p>
            </div>
            {data.dueDate && (
              <div>
                <span className="text-muted-foreground">Termin płatności</span>
                <p className="font-medium">{formatDate(data.dueDate)}</p>
              </div>
            )}
            {data.bankAccountNumber && (
              <div>
                <span className="text-muted-foreground">Nr rachunku</span>
                <p className="font-mono text-xs font-medium">
                  {data.bankAccountNumber}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {data.lineItems && data.lineItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pozycje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Lp</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="w-16">Jedn.</TableHead>
                    <TableHead className="w-16 text-right">Ilość</TableHead>
                    <TableHead className="w-24 text-right">
                      Cena netto
                    </TableHead>
                    <TableHead className="w-24 text-right">
                      Wart. netto
                    </TableHead>
                    <TableHead className="w-16 text-right">VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lineItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.lineNumber || i + 1}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.description || "—"}
                      </TableCell>
                      <TableCell>{item.unit || "—"}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.unitPriceNet != null
                          ? formatCurrency(item.unitPriceNet)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.amountNet != null
                          ? formatCurrency(item.amountNet)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.vatRate != null ? `${item.vatRate}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-sm text-muted-foreground">Netto</span>
              <p className="text-xl font-bold">
                {data.amountNet != null
                  ? formatCurrency(data.amountNet)
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">VAT</span>
              <p className="text-xl font-bold">
                {data.amountVat != null
                  ? formatCurrency(data.amountVat)
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Brutto</span>
              <p className="text-xl font-bold text-primary">
                {data.amountGross != null
                  ? formatCurrency(data.amountGross)
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ManualPreview({ doc }: { doc: DocumentRow }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <PartyCard
          title="Kontrahent"
          party={{
            name: doc.contractor.name,
            nip: doc.contractor.nip,
            address: doc.contractor.address,
          }}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Dane dokumentu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Numer faktury</span>
              <p className="font-medium">{doc.invoiceNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Typ dokumentu</span>
              <p className="font-medium">{doc.documentType.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data wystawienia</span>
              <p className="font-medium">{formatDate(doc.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Termin płatności</span>
              <p className="font-medium">{formatDate(doc.dueDate)}</p>
            </div>
            {doc.category && (
              <div>
                <span className="text-muted-foreground">Kategoria</span>
                <p className="font-medium">{doc.category.name}</p>
              </div>
            )}
            {doc.bankAccountNumber && (
              <div>
                <span className="text-muted-foreground">Nr rachunku</span>
                <p className="font-mono text-xs font-medium">
                  {doc.bankAccountNumber}
                </p>
              </div>
            )}
            {doc.ksefNumber && (
              <div>
                <span className="text-muted-foreground">Numer KSeF</span>
                <p className="font-mono text-xs font-medium">
                  {doc.ksefNumber}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-sm text-muted-foreground">Netto</span>
              <p className="text-xl font-bold">
                {formatCurrency(doc.amountNet)}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">VAT</span>
              <p className="text-xl font-bold">
                {formatCurrency(doc.amountVat)}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Brutto</span>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(doc.amountGross)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getPreviewVariant(
  doc: DocumentRow
): "pdf" | "xml" | "manual" {
  if (doc.fileType?.includes("pdf") && doc.fileName) return "pdf";
  if (doc.xmlData) return "xml";
  return "manual";
}

export function DocumentPreview({ open, onClose, document: doc }: Props) {
  if (!doc) return null;

  const variant = getPreviewVariant(doc);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[600px] overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Podgląd dokumentu</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <PreviewHeader doc={doc} />
          <Separator />

          {variant === "pdf" && <PdfViewerLazy documentId={doc.id} />}

          {variant === "xml" && (
            <XmlPreview
              data={
                (doc.xmlData as { xmlContent?: string })?.xmlContent
                  ? parseXmlContent((doc.xmlData as { xmlContent: string }).xmlContent)
                  : (doc.xmlData as XmlInvoiceData)
              }
            />
          )}

          {variant === "manual" && <ManualPreview doc={doc} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
