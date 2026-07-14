"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDocuments } from "@/lib/hooks/use-documents";
import { DocumentDataTable } from "@/components/documents/data-table";
import { DocumentFilters } from "@/components/documents/document-filters";
import { ColumnConfigDialog } from "@/components/documents/column-config-dialog";
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

export default function DocumentsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentRow | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (filters.documentTypeId) p.documentTypeId = filters.documentTypeId;
    if (filters.contractorId) p.contractorId = filters.contractorId;
    if (filters.categoryId) p.categoryId = filters.categoryId;
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
    if (filters.dueDateFrom) p.dueDateFrom = filters.dueDateFrom;
    if (filters.dueDateTo) p.dueDateTo = filters.dueDateTo;
    if (filters.search) p.search = filters.search;
    return p;
  }, [filters]);

  const { data: documents, isLoading } = useDocuments(queryParams);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rejestr dokumentów</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzaj fakturami i dokumentami księgowymi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnConfigDialog />
          <Button onClick={() => { setEditDoc(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj dokument
          </Button>
        </div>
      </div>

      <DocumentFilters filters={filters} onChange={setFilters} />

      <DocumentDataTable
        data={documents || []}
        isLoading={isLoading}
        onRowClick={(doc) => {
          setEditDoc(doc);
          setFormOpen(true);
        }}
        onPreview={(doc) => setPreviewDoc(doc)}
      />

      <DocumentFormSheet
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDoc(null); }}
        editDocument={editDoc}
      />

      <DocumentPreview
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
    </div>
  );
}
