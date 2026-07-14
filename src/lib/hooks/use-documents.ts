"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Wystąpił błąd");
  return json.data;
}

export function useDocuments(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => fetchJson(`/api/documents?${query}`),
  });
}

export function useDocument(id: string | null) {
  return useQuery({
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
      qc.invalidateQueries({ queryKey: ["documents"] });
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
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
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

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchJson("/api/categories"),
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
