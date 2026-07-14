"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { DocumentRow } from "./document-columns";

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

export function DocumentPreview({ open, onClose, document: doc }: Props) {
  if (!doc) return null;

  const sourceBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    KSEF: { label: "KSeF", variant: "default" },
    UPLOAD: { label: "Upload", variant: "secondary" },
    MANUAL: { label: "Ręczny", variant: "outline" },
  };

  const statusBadge: Record<string, { label: string; className: string }> = {
    BUFFER: { label: "Bufor", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    ACCEPTED: { label: "Zaakceptowany", className: "bg-green-100 text-green-800 border-green-300" },
  };

  const src = sourceBadge[doc.source] || sourceBadge.MANUAL;
  const st = statusBadge[doc.status] || statusBadge.BUFFER;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[600px] overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Podgląd dokumentu</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant={src.variant}>{src.label}</Badge>
            <Badge variant="outline" className={st.className}>{st.label}</Badge>
          </div>

          <div>
            <h3 className="text-lg font-semibold">{doc.invoiceNumber}</h3>
            <p className="text-sm text-muted-foreground">{doc.documentType.name}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Kontrahent</span>
              <p className="font-medium">{doc.contractor.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Kategoria</span>
              <p className="font-medium">{doc.category?.name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Data wystawienia</span>
              <p className="font-medium">{formatDate(doc.issueDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Termin płatności</span>
              <p className="font-medium">{formatDate(doc.dueDate)}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Netto</span>
              <p className="text-lg font-semibold">{formatCurrency(doc.amountNet)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">VAT</span>
              <p className="text-lg font-semibold">{formatCurrency(doc.amountVat)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Brutto</span>
              <p className="text-lg font-semibold">{formatCurrency(doc.amountGross)}</p>
            </div>
          </div>

          {doc.bankAccountNumber && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">Nr rachunku bankowego</span>
                <p className="font-mono font-medium">{doc.bankAccountNumber}</p>
              </div>
            </>
          )}

          {doc.ksefNumber && (
            <div className="text-sm">
              <span className="text-muted-foreground">Numer KSeF</span>
              <p className="font-mono font-medium">{doc.ksefNumber}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
