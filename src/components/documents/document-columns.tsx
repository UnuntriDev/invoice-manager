"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/money";
import { formatDocumentDate } from "@/lib/dates";
import { formatBankAccountNumber } from "@/lib/document-list-presentation";

export interface DocumentRow {
  id: string;
  invoiceNumber: string;
  documentTypeId: string;
  documentType: {
    id: string;
    name: string;
    direction: "RECEIVABLE" | "PAYABLE";
    isSystem: boolean;
  };
  contractorId: string;
  contractor: {
    id: string;
    name: string;
    nip: string;
    address: string | null;
    bankAccountNumber: string | null;
    defaultCategoryId: string | null;
  };
  issueDate: string;
  dueDate: string;
  amountNet: string;
  amountVat: string;
  amountGross: string;
  categoryId: string | null;
  category: { id: string; name: string; parentId: string | null } | null;
  source: "KSEF" | "UPLOAD" | "MANUAL";
  status: "BUFFER" | "ACCEPTED";
  ksefNumber: string | null;
  bankAccountNumber: string | null;
  fileName: string | null;
  filePath: string | null;
  fileType: string | null;
  xmlData: unknown | null;
  createdAt: string;
  updatedAt: string;
}

const badgeShape = "rounded-full border px-2.5 py-0.5 text-xs font-medium";

export const sourceBadge: Record<string, { label: string; className: string }> = {
  KSEF: {
    label: "KSeF",
    className: `${badgeShape} border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300`,
  },
  UPLOAD: {
    label: "Upload",
    className: `${badgeShape} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300`,
  },
  MANUAL: {
    label: "Ręczny",
    className: `${badgeShape} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300`,
  },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  BUFFER: { label: "Bufor", className: `${badgeShape} bg-yellow-100 text-yellow-800 border-yellow-300` },
  ACCEPTED: { label: "Zaakceptowany", className: `${badgeShape} bg-green-100 text-green-800 border-green-300` },
};

function SortableHeader({
  column,
  label,
}: {
  column: Column<DocumentRow, unknown>;
  label: string;
}) {
  const direction = column.getIsSorted();
  const SortIcon =
    direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 h-8 text-xs uppercase tracking-wider"
      onClick={() => column.toggleSorting(direction === "asc")}
      aria-label={`${label}. ${
        direction === "asc"
          ? "Sortowanie rosnące"
          : direction === "desc"
            ? "Sortowanie malejące"
            : "Brak sortowania"
      }`}
    >
      {label}
      <SortIcon className="ml-1 size-3.5" aria-hidden="true" />
    </Button>
  );
}

export function getColumns(
  onPreview: (doc: DocumentRow) => void,
  onEdit: (doc: DocumentRow) => void,
  onDelete: (doc: DocumentRow) => void
): ColumnDef<DocumentRow>[] {
  return [
    {
      id: "actions",
      header: () => <span className="sr-only">Akcje</span>,
      size: 128,
      cell: ({ row }) => {
        const invoiceNumber = row.original.invoiceNumber;
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 hover:text-primary"
              aria-label={`Podgląd dokumentu ${invoiceNumber}`}
              title="Podgląd"
              onClick={(event) => {
                event.stopPropagation();
                onPreview(row.original);
              }}
            >
              <Eye className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 hover:text-primary"
              aria-label={`Edytuj dokument ${invoiceNumber}`}
              title="Edytuj"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(row.original);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Usuń dokument ${invoiceNumber}`}
              title="Usuń"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(row.original);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "invoiceNumber",
      header: "Numer faktury",
      cell: ({ getValue }) => (
        <span className="font-mono font-medium">{getValue<string>()}</span>
      ),
      size: 160,
    },
    {
      id: "documentType",
      accessorFn: (row) => row.documentType.name,
      header: "Typ",
      size: 160,
    },
    {
      id: "contractor",
      accessorFn: (row) => row.contractor.name,
      header: "Kontrahent",
      size: 200,
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <SortableHeader column={column} label="Data wystawienia" />
      ),
      cell: ({ getValue }) => formatDocumentDate(getValue<string>()),
      size: 140,
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <SortableHeader column={column} label="Termin płatności" />
      ),
      cell: ({ getValue }) => formatDocumentDate(getValue<string>()),
      size: 140,
    },
    {
      accessorKey: "amountNet",
      header: () => <div className="text-right">Netto</div>,
      cell: ({ getValue }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrency(getValue<string>())}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: "amountVat",
      header: () => <div className="text-right">VAT</div>,
      cell: ({ getValue }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrency(getValue<string>())}
        </div>
      ),
      size: 100,
    },
    {
      accessorKey: "amountGross",
      header: () => <div className="text-right">Brutto</div>,
      cell: ({ getValue }) => (
        <div className="text-right font-mono font-semibold tabular-nums">
          {formatCurrency(getValue<string>())}
        </div>
      ),
      size: 120,
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.name ?? "—",
      header: "Kategoria",
      size: 140,
    },
    {
      accessorKey: "source",
      header: "Źródło",
      cell: ({ getValue }) => {
        const src = getValue<string>();
        const badge = sourceBadge[src] || sourceBadge.MANUAL;
        return (
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        );
      },
      size: 100,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const st = getValue<string>();
        const badge = statusBadge[st] || statusBadge.BUFFER;
        return (
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        );
      },
      size: 120,
    },
    {
      accessorKey: "ksefNumber",
      header: "Numer KSeF",
      cell: ({ getValue }) => formatBankAccountNumber(getValue<string | null>()),
      size: 180,
    },
    {
      accessorKey: "bankAccountNumber",
      header: "Nr rachunku",
      cell: ({ getValue }) => getValue<string>() || "—",
      size: 200,
    },
  ];
}

export const COLUMN_LABELS: Record<string, string> = {
  invoiceNumber: "Numer faktury",
  documentType: "Typ",
  contractor: "Kontrahent",
  issueDate: "Data wystawienia",
  dueDate: "Termin płatności",
  amountNet: "Netto",
  amountVat: "VAT",
  amountGross: "Brutto",
  category: "Kategoria",
  source: "Źródło",
  status: "Status",
  ksefNumber: "Numer KSeF",
  bankAccountNumber: "Nr rachunku",
};
