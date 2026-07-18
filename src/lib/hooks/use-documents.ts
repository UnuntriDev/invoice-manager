"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  DocumentDetail,
  DocumentRow,
} from "@/components/documents/document-columns";

export interface DocumentPage {
  items: DocumentRow[];
  nextCursor: string | null;
  /** Łączna liczba dokumentów pasujących do filtrów (wszystkie strony). */
  total: number;
}

export function invalidateDocumentViews(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["documents"] });
  void queryClient.invalidateQueries({ queryKey: ["buffer"] });
}

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      res.ok
        ? "Serwer zwrócił nieoczekiwany format odpowiedzi"
        : `Błąd serwera (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Wystąpił błąd");
  return json.data;
}

export function useDocuments(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return useQuery<DocumentPage>({
    queryKey: ["documents", params],
    queryFn: async () =>
      (await fetchJson(`/api/documents?${query}`)) as DocumentPage,
    placeholderData: keepPreviousData,
  });
}

export function useDocument(id: string | null) {
  return useQuery<DocumentDetail>({
    queryKey: ["document", id],
    queryFn: () => fetchJson(`/api/documents/${id}`),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchJson("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateDocumentViews(qc);
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetchJson(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateDocumentViews(qc);
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateDocumentViews(qc);
    },
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: ["documentTypes"],
    queryFn: () => fetchJson("/api/document-types"),
  });
}

export function useContractors() {
  return useQuery({
    queryKey: ["contractors"],
    queryFn: () => fetchJson("/api/contractors"),
  });
}

export function useCreateContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchJson("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useUpdateContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetchJson(`/api/contractors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useDeleteContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/contractors/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchJson("/api/categories"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string | null }) =>
      fetchJson("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; parentId?: string | null } }) =>
      fetchJson(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["contractors"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useCreateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; direction: string }) =>
      fetchJson("/api/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentTypes"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useUpdateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      fetchJson(`/api/document-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentTypes"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useDeleteDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/document-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentTypes"] });
      invalidateDocumentViews(qc);
    },
  });
}

export function useColumnConfig() {
  return useQuery({
    queryKey: ["columnConfig"],
    queryFn: () => fetchJson("/api/column-config"),
  });
}

export function useUpdateColumnConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columns: Array<{ columnKey: string; isVisible: boolean; position: number }>) =>
      fetchJson("/api/column-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["columnConfig"] });
    },
  });
}

export function useBufferDocuments(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return useQuery<DocumentPage>({
    queryKey: ["buffer", params],
    queryFn: () => fetchJson(`/api/buffer?${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useAcceptDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) =>
      fetchJson("/api/documents/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buffer"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useKSeFetch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { dateFrom: string; dateTo: string; type: string }) =>
      fetchJson("/api/ksef/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buffer"] });
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      fetchJson("/api/upload", { method: "POST", body: formData }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buffer"] });
    },
  });
}

export interface PdfExtractionResult {
  fields: Partial<{
    invoiceNumber: string;
    contractorId: string;
    issueDate: string;
    dueDate: string;
    amountNet: string;
    amountVat: string;
    amountGross: string;
  }>;
  detected: string[];
  warnings: string[];
}

export function useUploadConfig() {
  return useQuery<{ maxSizeBytes: number; maxSizeMb: number }>({
    queryKey: ["upload-config"],
    queryFn: () => fetchJson("/api/config/upload"),
    staleTime: Infinity,
  });
}

export function useExtractPdfDocument() {
  return useMutation<PdfExtractionResult, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return (await fetchJson("/api/upload/extract", {
        method: "POST",
        body: formData,
      })) as PdfExtractionResult;
    },
  });
}

export function useKSeFSchedules() {
  return useQuery({
    queryKey: ["ksef-schedules"],
    queryFn: () => fetchJson("/api/ksef/schedule"),
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { hour: number; minute: number; fetchType: string; isActive: boolean }) =>
      fetchJson("/api/ksef/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ksef-schedules"] });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { hour: number; minute: number; fetchType: string; isActive: boolean } }) =>
      fetchJson(`/api/ksef/schedule/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ksef-schedules"] });
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/ksef/schedule/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ksef-schedules"] });
    },
  });
}

export function useRunSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/ksef/schedule/${id}/run`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ksef-schedules"] });
      qc.invalidateQueries({ queryKey: ["buffer"] });
    },
  });
}
