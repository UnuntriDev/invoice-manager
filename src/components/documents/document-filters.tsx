"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  useCategories,
  useContractors,
  useDocumentTypes,
} from "@/lib/hooks/use-documents";
import { cn } from "@/lib/utils";

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
}

export interface DocumentsFilterState {
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
  filters: DocumentsFilterState;
  onChange: (filters: DocumentsFilterState) => void;
}

function flattenCategories(
  categories: CategoryNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const category of categories) {
    result.push({ id: category.id, name: category.name, depth });
    if (category.children?.length) {
      result.push(...flattenCategories(category.children, depth + 1));
    }
  }
  return result;
}

const emptyFilters: DocumentsFilterState = {
  documentTypeId: "",
  contractorId: "",
  categoryId: "",
  dateFrom: "",
  dateTo: "",
  dueDateFrom: "",
  dueDateTo: "",
  search: "",
};

export function DocumentFilters({ filters, onChange }: Props) {
  const documentTypesQuery = useDocumentTypes();
  const contractorsQuery = useContractors();
  const categoriesQuery = useCategories();
  const hasDateFilters = Boolean(
    filters.dateFrom || filters.dateTo || filters.dueDateFrom || filters.dueDateTo
  );
  const [showAdvanced, setShowAdvanced] = useState(hasDateFilters);

  const flatCategories = categoriesQuery.data
    ? flattenCategories(categoriesQuery.data)
    : [];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const dictionaryError =
    documentTypesQuery.isError ||
    contractorsQuery.isError ||
    categoriesQuery.isError;

  const update = (key: keyof DocumentsFilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <Card
      role="region"
      aria-labelledby="document-filters-heading"
      className="block gap-0 p-4 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="document-filters-heading" className="text-sm font-semibold">
            Filtry
          </h2>
          {activeFilterCount > 0 && (
            <span
              className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
              aria-label={`Aktywne filtry: ${activeFilterCount}`}
            >
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showAdvanced}
            aria-controls="advanced-document-filters"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            Zakresy dat
            <ChevronDown
              className={cn(
                "ml-1 size-4 transition-transform",
                showAdvanced && "rotate-180"
              )}
              aria-hidden="true"
            />
          </Button>
          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(emptyFilters)}
            >
              <X className="mr-1 size-4" aria-hidden="true" />
              Wyczyść filtry
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="documents-search">Szukaj</Label>
          <Input
            id="documents-search"
            type="search"
            autoComplete="off"
            placeholder="Numer faktury lub kontrahent"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="document-type-filter">Typ dokumentu</Label>
          <Select
            value={filters.documentTypeId || null}
            onValueChange={(value) => update("documentTypeId", value ?? "")}
            disabled={documentTypesQuery.isLoading || documentTypesQuery.isError}
            items={{
              ...Object.fromEntries(
                documentTypesQuery.data?.map((type: { id: string; name: string }) => [
                  type.id,
                  type.name,
                ]) ?? []
              ),
            }}
          >
            <SelectTrigger id="document-type-filter" className="w-full">
              <SelectValue
                placeholder={
                  documentTypesQuery.isLoading ? "Ładowanie…" : "Wszystkie typy"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {documentTypesQuery.data?.map(
                (type: { id: string; name: string }) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contractor-filter">Kontrahent</Label>
          <Select
            value={filters.contractorId || null}
            onValueChange={(value) => update("contractorId", value ?? "")}
            disabled={contractorsQuery.isLoading || contractorsQuery.isError}
            items={{
              ...Object.fromEntries(
                contractorsQuery.data?.map(
                  (contractor: { id: string; name: string }) => [
                    contractor.id,
                    contractor.name,
                  ]
                ) ?? []
              ),
            }}
          >
            <SelectTrigger id="contractor-filter" className="w-full">
              <SelectValue
                placeholder={
                  contractorsQuery.isLoading ? "Ładowanie…" : "Wszyscy kontrahenci"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {contractorsQuery.data?.map(
                (contractor: { id: string; name: string }) => (
                  <SelectItem key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-filter">Kategoria</Label>
          <Select
            value={filters.categoryId || null}
            onValueChange={(value) => update("categoryId", value ?? "")}
            disabled={categoriesQuery.isLoading || categoriesQuery.isError}
            items={{
              ...Object.fromEntries(
                flatCategories.map((category) => [
                  category.id,
                  `${"— ".repeat(category.depth)}${category.name}`,
                ])
              ),
            }}
          >
            <SelectTrigger id="category-filter" className="w-full">
              <SelectValue
                placeholder={
                  categoriesQuery.isLoading ? "Ładowanie…" : "Wszystkie kategorie"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {flatCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {`${"— ".repeat(category.depth)}${category.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dictionaryError && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          Nie udało się załadować części opcji filtrów. Odśwież stronę i spróbuj ponownie.
        </p>
      )}

      {showAdvanced && (
        <div
          id="advanced-document-filters"
          className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2"
        >
          <fieldset className="space-y-3 rounded-md bg-muted/40 p-3">
            <legend className="px-1 text-sm font-medium">Data wystawienia</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-date-from">Od</Label>
                <Input
                  id="issue-date-from"
                  type="date"
                  lang="pl-PL"
                  max={filters.dateTo || undefined}
                  value={filters.dateFrom}
                  onChange={(event) => update("dateFrom", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-date-to">Do</Label>
                <Input
                  id="issue-date-to"
                  type="date"
                  lang="pl-PL"
                  min={filters.dateFrom || undefined}
                  value={filters.dateTo}
                  onChange={(event) => update("dateTo", event.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-md bg-muted/40 p-3">
            <legend className="px-1 text-sm font-medium">Termin płatności</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="due-date-from">Od</Label>
                <Input
                  id="due-date-from"
                  type="date"
                  lang="pl-PL"
                  max={filters.dueDateTo || undefined}
                  value={filters.dueDateFrom}
                  onChange={(event) => update("dueDateFrom", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-date-to">Do</Label>
                <Input
                  id="due-date-to"
                  type="date"
                  lang="pl-PL"
                  min={filters.dueDateFrom || undefined}
                  value={filters.dueDateTo}
                  onChange={(event) => update("dueDateTo", event.target.value)}
                />
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </Card>
  );
}
