"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type OnChangeFn,
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
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  FileX,
  RotateCw,
  X,
} from "lucide-react";
import { getColumns, type DocumentRow } from "./document-columns";
import { useColumnConfig } from "@/lib/hooks/use-documents";
import { cn } from "@/lib/utils";
import { getDocumentEmptyState } from "@/lib/document-list-presentation";

interface Props {
  data: DocumentRow[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onRowClick: (doc: DocumentRow) => void;
  onPreview: (doc: DocumentRow) => void;
  onEdit: (doc: DocumentRow) => void;
  onDelete: (doc: DocumentRow) => void;
  onRetry: () => void;
  onClearFilters: () => void;
  onAddDocument: () => void;
  hasActiveFilters: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pageNumber: number;
  pageSize: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

function PaginationControls({
  pageNumber,
  canPreviousPage,
  canNextPage,
  isLoading,
  onPreviousPage,
  onNextPage,
}: Pick<
  Props,
  | "pageNumber"
  | "canPreviousPage"
  | "canNextPage"
  | "isLoading"
  | "onPreviousPage"
  | "onNextPage"
>) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPreviousPage}
        disabled={!canPreviousPage || isLoading}
      >
        <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
        Poprzednia
      </Button>
      <span className="text-sm text-muted-foreground">Strona {pageNumber}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={!canNextPage || isLoading}
      >
        Następna
        <ChevronRight className="ml-1 size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function DocumentDataTable({
  data,
  isLoading,
  isFetching,
  isError,
  error,
  onRowClick,
  onPreview,
  onEdit,
  onDelete,
  onRetry,
  onClearFilters,
  onAddDocument,
  hasActiveFilters,
  sorting,
  onSortingChange,
  pageNumber,
  pageSize,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
}: Props) {
  const { data: columnConfig, isLoading: isColumnConfigLoading } = useColumnConfig();
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

  const columns = getColumns(onPreview, onEdit, onDelete);
  const emptyState = getDocumentEmptyState(hasActiveFilters);
  const showInitialLoading = isLoading || isColumnConfigLoading;

  // TanStack Table exposes unstable callbacks by design; React Compiler safely
  // opts this component out of memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder },
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
  });

  if (isError && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
        <CircleAlert className="mb-4 size-12 text-destructive" aria-hidden="true" />
        <h3 className="text-lg font-semibold">Nie udało się załadować dokumentów</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error?.message || "Sprawdź połączenie i spróbuj ponownie."}
        </p>
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <span>Nie udało się odświeżyć danych. Wyświetlam ostatnią dostępną wersję.</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        </div>
      )}
      <div className="rounded-md border [&_[data-slot=table-container]]:max-h-[65vh] [&_[data-slot=table-container]]:overflow-auto">
        <Table
          className="min-w-[1100px]"
          aria-busy={isFetching}
          aria-label="Rejestr zaakceptowanych dokumentów"
        >
        <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={cn(
                    header.column.id === "actions" &&
                      "sticky left-0 z-30 bg-muted/95"
                  )}
                  aria-sort={
                    header.column.getCanSort()
                      ? header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {showInitialLoading ? (
            Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={`loading-${rowIndex}`} aria-hidden="true">
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell key={column.id}>
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={Math.max(1, table.getVisibleLeafColumns().length)}>
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <FileX className="mb-4 size-12 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-lg font-semibold">
                    {emptyState.title}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {emptyState.description}
                  </p>
                  <Button
                    className="mt-5"
                    variant={hasActiveFilters ? "outline" : "default"}
                    onClick={hasActiveFilters ? onClearFilters : onAddDocument}
                  >
                    {hasActiveFilters ? (
                      <X className="mr-2 size-4" aria-hidden="true" />
                    ) : (
                      <FilePlus2 className="mr-2 size-4" aria-hidden="true" />
                    )}
                    {emptyState.actionLabel}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              tabIndex={0}
              aria-label={`Otwórz podgląd dokumentu ${row.original.invoiceNumber}`}
              className="group cursor-pointer transition-colors even:bg-muted/50 hover:bg-muted focus-visible:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onRowClick(row.original)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    cell.column.id === "actions" &&
                      "sticky left-0 z-10 bg-background group-even:bg-muted group-hover:bg-muted group-focus-visible:bg-muted/70"
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
      {!showInitialLoading && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {isFetching
              ? "Aktualizowanie danych…"
              : `Widoczne ${
                  (pageNumber - 1) * pageSize + 1
                }–${(pageNumber - 1) * pageSize + data.length}`}
          </p>
          <PaginationControls
            pageNumber={pageNumber}
            canPreviousPage={canPreviousPage}
            canNextPage={canNextPage}
            isLoading={isFetching}
            onPreviousPage={onPreviousPage}
            onNextPage={onNextPage}
          />
        </div>
      )}
    </div>
  );
}
