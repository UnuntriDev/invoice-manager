"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteDocument,
  useDocuments,
} from "@/lib/hooks/use-documents";
import { useNotifications } from "@/components/notification-context";
import { DocumentDataTable } from "@/components/documents/data-table";
import { DocumentFilters } from "@/components/documents/document-filters";
import { DocumentFormSheet } from "@/components/documents/document-form";
import { DocumentPreview } from "@/components/documents/document-preview";
import type { DocumentRow } from "@/components/documents/document-columns";

const emptyFilters = {
  documentTypeId: "",
  contractorId: "",
  categoryId: "",
  dateFrom: "",
  dateTo: "",
  dueDateFrom: "",
  dueDateTo: "",
  search: "",
};

function DocumentsPageContent() {
  const searchParams = useSearchParams();
  const pageRouter = useRouter();
  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "issueDate", desc: true },
  ]);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const actionAdd = searchParams.get("action") === "add";
  const [formOpen, setFormOpen] = useState(actionAdd);
  const [editDoc, setEditDoc] = useState<DocumentRow | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const deleteDocument = useDeleteDocument();
  const { add: addNotification } = useNotifications();

  useEffect(() => {
    if (actionAdd) pageRouter.replace("/documents");
  }, [actionAdd, pageRouter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filters.documentTypeId) p.documentTypeId = filters.documentTypeId;
    if (filters.contractorId) p.contractorId = filters.contractorId;
    if (filters.categoryId) p.categoryId = filters.categoryId;
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
    if (filters.dueDateFrom) p.dueDateFrom = filters.dueDateFrom;
    if (filters.dueDateTo) p.dueDateTo = filters.dueDateTo;
    if (debouncedSearch) p.search = debouncedSearch;
    p.sortBy = sorting[0]?.id === "dueDate" ? "dueDate" : "issueDate";
    p.sortOrder = sorting[0]?.desc === false ? "asc" : "desc";
    p.pageSize = "20";
    const cursor = cursorHistory[pageIndex];
    if (cursor) p.cursor = cursor;
    return p;
  }, [cursorHistory, debouncedSearch, filters, pageIndex, sorting]);

  const documentsQuery = useDocuments(queryParams);
  const { data: documents, isLoading, isFetching, isError, error } = documentsQuery;

  const resetPagination = () => {
    setCursorHistory([undefined]);
    setPageIndex(0);
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((current) =>
      typeof updater === "function" ? updater(current) : updater
    );
    resetPagination();
  };

  const goToNextPage = () => {
    if (!documents?.nextCursor) return;
    setCursorHistory((current) => [
      ...current.slice(0, pageIndex + 1),
      documents.nextCursor ?? undefined,
    ]);
    setPageIndex((current) => current + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteDocument.mutateAsync(deleteTarget.id);
      toast.success(`Usunięto dokument ${deleteTarget.invoiceNumber}`);
      addNotification({ title: `Usunięto dokument`, description: deleteTarget.invoiceNumber });
      setDeleteTarget(null);

      if ((documents?.items.length ?? 0) === 1 && pageIndex > 0) {
        setPageIndex((current) => Math.max(0, current - 1));
      }
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Nie udało się usunąć dokumentu"
      );
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Rejestr dokumentów</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Zarządzaj fakturami i dokumentami księgowymi
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={() => { setEditDoc(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj dokument
          </Button>
        </div>
      </div>

      <DocumentFilters
        filters={filters}
        onChange={(nextFilters) => {
          setFilters(nextFilters);
          resetPagination();
        }}
        resultCount={documents?.total ?? 0}
      />

      <DocumentDataTable
        data={documents?.items ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
        onRowClick={(doc) => {
          setPreviewDoc(doc);
        }}
        onPreview={(doc) => setPreviewDoc(doc)}
        onEdit={(doc) => {
          setEditDoc(doc);
          setFormOpen(true);
        }}
        onDelete={(doc) => setDeleteTarget(doc)}
        onRetry={() => void documentsQuery.refetch()}
        onClearFilters={() => {
          setFilters(emptyFilters);
          resetPagination();
        }}
        onAddDocument={() => {
          setEditDoc(null);
          setFormOpen(true);
        }}
        hasActiveFilters={Object.values(filters).some(Boolean)}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        pageNumber={pageIndex + 1}
        pageSize={20}
        canPreviousPage={pageIndex > 0}
        canNextPage={!!documents?.nextCursor}
        onPreviousPage={() =>
          setPageIndex((current) => Math.max(0, current - 1))
        }
        onNextPage={goToNextPage}
      />

      <DocumentFormSheet
        key={editDoc?.id ?? "new-document"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDoc(null); }}
        editDocument={editDoc}
      />

      <DocumentPreview
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onEdit={(document) => {
          setEditDoc(document);
          setFormOpen(true);
        }}
        document={previewDoc}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteDocument.isPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="sm:place-items-center! sm:text-center!">
            <AlertDialogTitle>Usunąć dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokument &quot;{deleteTarget?.invoiceNumber}&quot; oraz jego
              załącznik zostaną trwale usunięte. Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="items-center sm:justify-center!">
            <AlertDialogCancel disabled={deleteDocument.isPending}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteDocument.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteDocument.isPending ? "Usuwanie…" : "Usuń dokument"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsPageContent />
    </Suspense>
  );
}
