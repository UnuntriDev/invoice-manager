"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export interface DocumentRow {
  id: string;
  invoiceNumber: string;
  documentType: { name: string };
  contractor: { name: string };
  issueDate: string;
  dueDate: string;
  amountNet: string | number;
  amountVat: string | number;
  amountGross: string | number;
  category: { name: string } | null;
  source: "KSEF" | "UPLOAD" | "MANUAL";
  status: "BUFFER" | "ACCEPTED";
  ksefNumber: string | null;
  bankAccountNumber: string | null;
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

const sourceBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  KSEF: { label: "KSeF", variant: "default" },
  UPLOAD: { label: "Upload", variant: "secondary" },
  MANUAL: { label: "Ręczny", variant: "outline" },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  BUFFER: { label: "Bufor", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  ACCEPTED: { label: "Zaakceptowany", className: "bg-green-100 text-green-800 border-green-300" },
};

export function getColumns(onPreview: (doc: DocumentRow) => void): ColumnDef<DocumentRow>[] {
  return [
    {
      id: "actions",
      header: "",
      size: 40,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(row.original);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: "Numer faktury",
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
        <Button
          variant="ghost"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Data wystawienia
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => formatDate(getValue<string>()),
      size: 140,
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Termin płatności
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => formatDate(getValue<string>()),
      size: 140,
    },
    {
      accessorKey: "amountNet",
      header: "Netto",
      cell: ({ getValue }) => formatCurrency(getValue<string>()),
      size: 120,
    },
    {
      accessorKey: "amountVat",
      header: "VAT",
      cell: ({ getValue }) => formatCurrency(getValue<string>()),
      size: 100,
    },
    {
      accessorKey: "amountGross",
      header: "Brutto",
      cell: ({ getValue }) => formatCurrency(getValue<string>()),
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
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
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
      cell: ({ getValue }) => getValue<string>() || "—",
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
