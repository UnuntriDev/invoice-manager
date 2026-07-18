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
import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  Eye,
  FilePlus2,
  FileX,
  Pencil,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import {
  getColumns,
  sourceBadge,
  statusBadge,
  type DocumentRow,
} from "./document-columns";
import { useColumnConfig } from "@/lib/hooks/use-documents";
import { cn } from "@/lib/utils";
import { getDocumentEmptyState } from "@/lib/document-list-presentation";
import { formatCurrency } from "@/lib/money";
import { formatDocumentDate } from "@/lib/dates";

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
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 sm:h-7"
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
        className="h-11 sm:h-7"
        onClick={onNextPage}
        disabled={!canNextPage || isLoading}
      >
        Następna
        <ChevronRight className="ml-1 size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function MobileDocumentList({
  data,
  isLoading,
  onPreview,
  onEdit,
  onDelete,
  onAddDocument,
  onClearFilters,
  hasActiveFilters,
}: Pick<
  Props,
  | "data"
  | "isLoading"
  | "onPreview"
  | "onEdit"
  | "onDelete"
  | "onAddDocument"
  | "onClearFilters"
  | "hasActiveFilters"
>) {
  const emptyState = getDocumentEmptyState(hasActiveFilters);

  if (isLoading) {
    return (
      <div className="space-y-2 md:hidden" aria-label="Ładowanie dokumentów">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-5 py-12 text-center md:hidden">
        <FileX className="mb-3 size-10 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-semibold">{emptyState.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyState.description}</p>
        <Button
          className="mt-5 min-h-11"
          variant={hasActiveFilters ? "outline" : "default"}
          onClick={hasActiveFilters ? onClearFilters : onAddDocument}
        >
          {hasActiveFilters ? <X aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}
          {emptyState.actionLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:hidden" aria-label="Rejestr zaakceptowanych dokumentów">
      {data.map((document) => {
        const source = sourceBadge[document.source] || sourceBadge.MANUAL;
        const status = statusBadge[document.status] || statusBadge.ACCEPTED;

        return (
          <article
            key={document.id}
            className="relative overflow-hidden rounded-xl border border-border bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:border-white/15"
          >
            <button
              type="button"
              className="w-full p-4 pr-16 text-left outline-none"
              onClick={() => onPreview(document)}
              aria-label={`Otwórz podgląd dokumentu ${document.invoiceNumber}`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-mono text-sm font-semibold">
                  {document.invoiceNumber}
                </span>
                <Badge variant="outline" className={source.className}>
                  {source.label}
                </Badge>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </div>
              <p className="mt-3 truncate text-sm font-medium">{document.contractor.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {document.documentType.name}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Termin</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {formatDocumentDate(document.dueDate)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">Brutto</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(document.amountGross)}
                  </dd>
                </div>
              </dl>
            </button>

            <div className="absolute top-2 right-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="size-11"
                      aria-label={`Akcje dokumentu ${document.invoiceNumber}`}
                    />
                  }
                >
                  <Ellipsis aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onPreview(document)}>
                    <Eye aria-hidden="true" />
                    Podgląd
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(document)}>
                    <Pencil aria-hidden="true" />
                    Edytuj
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(document)}>
                    <Trash2 aria-hidden="true" />
                    Usuń
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </article>
        );
      })}
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

  const columns = useMemo(
    () => getColumns(onPreview, onEdit, onDelete),
    [onPreview, onEdit, onDelete],
  );
  const emptyState = getDocumentEmptyState(hasActiveFilters);
  const showInitialLoading = isLoading || isColumnConfigLoading;

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
      <MobileDocumentList
        data={data}
        isLoading={showInitialLoading}
        onPreview={onPreview}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddDocument={onAddDocument}
        onClearFilters={onClearFilters}
        hasActiveFilters={hasActiveFilters}
      />
      <div className="hidden overflow-hidden rounded-md border border-border bg-card dark:border-white/15 md:block [&_[data-slot=table-container]]:overscroll-x-contain [&_td:last-child]:pr-5 [&_td]:px-3 [&_td]:py-2.5 [&_th:last-child]:pr-5 [&_th]:px-3 sm:[&_td:last-child]:pr-6 sm:[&_th:last-child]:pr-6">
        <Table
          className="min-w-[1100px]"
          aria-busy={isFetching}
          aria-label="Rejestr zaakceptowanych dokumentów"
        >
        <TableHeader className="sticky top-0 z-20 bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-foreground/80">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={cn(
                    header.column.id === "actions" &&
                      "sticky left-0 z-30 w-12 min-w-12 max-w-12 bg-muted px-2 text-center",
                    header.column.id === "amountGross" &&
                      "min-w-32 text-right"
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
                      "sticky left-0 z-10 w-12 min-w-12 max-w-12 bg-card px-2 text-center group-even:bg-muted group-hover:bg-muted group-focus-visible:bg-muted/70",
                    cell.column.id === "amountGross" &&
                      "min-w-32 text-right"
                  )}
                  {...(cell.column.id === "actions" && {
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  })}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
