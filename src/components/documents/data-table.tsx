"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type ColumnOrderState,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileX } from "lucide-react";
import { getColumns, type DocumentRow } from "./document-columns";
import { useColumnConfig } from "@/lib/hooks/use-documents";

interface Props {
  data: DocumentRow[];
  isLoading: boolean;
  onRowClick: (doc: DocumentRow) => void;
  onPreview: (doc: DocumentRow) => void;
}

export function DocumentDataTable({ data, isLoading, onRowClick, onPreview }: Props) {
  const { data: columnConfig } = useColumnConfig();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "issueDate", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);

  useEffect(() => {
    if (columnConfig) {
      const visibility: VisibilityState = {};
      const order: string[] = ["actions"];
      const sorted = [...columnConfig].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );
      for (const col of sorted) {
        visibility[(col as { columnKey: string }).columnKey] = (col as { isVisible: boolean }).isVisible;
        order.push((col as { columnKey: string }).columnKey);
      }
      setColumnVisibility(visibility);
      setColumnOrder(order);
    }
  }, [columnConfig]);

  const columns = getColumns(onPreview);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileX className="mb-4 h-16 w-16" />
        <h3 className="text-lg font-medium">Brak dokumentów</h3>
        <p className="text-sm">Dodaj pierwszy dokument lub pobierz faktury z KSeF</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
