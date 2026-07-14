"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useDocumentTypes, useContractors, useCategories } from "@/lib/hooks/use-documents";

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
}

interface FiltersState {
  documentTypeId: string;
  contractorId: string;
  categoryId: string;
  dateFrom: string;
  dateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  search: string;
}

interface Props {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
}

function flattenCategories(cats: CategoryNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const cat of cats) {
    result.push({ id: cat.id, name: cat.name, depth });
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return result;
}

export function DocumentFilters({ filters, onChange }: Props) {
  const { data: docTypes } = useDocumentTypes();
  const { data: contractors } = useContractors();
  const { data: categories } = useCategories();

  const flatCats = categories ? flattenCategories(categories) : [];

  const update = (key: keyof FiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasFilters = Object.values(filters).some((v) => v !== "");

  const clearFilters = () => {
    onChange({
      documentTypeId: "",
      contractorId: "",
      categoryId: "",
      dateFrom: "",
      dateTo: "",
      dueDateFrom: "",
      dueDateTo: "",
      search: "",
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Szukaj</label>
        <Input
          placeholder="Numer lub kontrahent..."
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          className="h-9 w-48"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Typ dokumentu</label>
        <Select value={filters.documentTypeId || null} onValueChange={(v) => update("documentTypeId", v === "__all__" ? "" : v ?? "")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Wszystkie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszystkie</SelectItem>
            {docTypes?.map((t: { id: string; name: string }) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Kontrahent</label>
        <Select value={filters.contractorId || null} onValueChange={(v) => update("contractorId", v === "__all__" ? "" : v ?? "")}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue placeholder="Wszyscy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszyscy</SelectItem>
            {contractors?.map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Kategoria</label>
        <Select value={filters.categoryId || null} onValueChange={(v) => update("categoryId", v === "__all__" ? "" : v ?? "")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Wszystkie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszystkie</SelectItem>
            {flatCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {"  ".repeat(c.depth) + c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Data wystawienia od</label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="h-9 w-36"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">do</label>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update("dateTo", e.target.value)}
          className="h-9 w-36"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Termin od</label>
        <Input
          type="date"
          value={filters.dueDateFrom}
          onChange={(e) => update("dueDateFrom", e.target.value)}
          className="h-9 w-36"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">do</label>
        <Input
          type="date"
          value={filters.dueDateTo}
          onChange={(e) => update("dueDateTo", e.target.value)}
          className="h-9 w-36"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
          <X className="mr-1 h-3 w-3" />
          Wyczyść filtry
        </Button>
      )}
    </div>
  );
}
