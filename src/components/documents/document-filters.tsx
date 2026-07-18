"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ColumnConfigDialog } from "@/components/documents/column-config-dialog";
import { Calendar, ChevronDown, ListFilter, Search, X } from "lucide-react";
import {
  useCategories,
  useContractors,
  useDocumentTypes,
} from "@/lib/hooks/use-documents";
import { cn } from "@/lib/utils";
import { flattenCategories } from "@/lib/categories";
import { documentsLabel, pluralizePl } from "@/lib/pluralize";

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
  /** Łączna liczba dokumentów pasujących do filtrów — licznik w drugim wierszu paska. */
  resultCount: number;
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

// Większy target dotykowy na mobile (h-11), kompaktowa wysokość od md (h-8).
const controlHeight = "h-11 min-h-11 md:h-8 md:min-h-0";

export function DocumentFilters({ filters, onChange, resultCount }: Props) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const documentTypesQuery = useDocumentTypes();
  const contractorsQuery = useContractors();
  const categoriesQuery = useCategories();

  const flatCategories = useMemo(
    () => (categoriesQuery.data ? flattenCategories(categoriesQuery.data, { prefix: "— " }) : []),
    [categoriesQuery.data],
  );

  const docTypeItems = useMemo(
    () => Object.fromEntries(
      documentTypesQuery.data?.map((type: { id: string; name: string }) => [type.id, type.name]) ?? [],
    ),
    [documentTypesQuery.data],
  );

  const contractorItems = useMemo(
    () => Object.fromEntries(
      contractorsQuery.data?.map((contractor: { id: string; name: string }) => [contractor.id, contractor.name]) ?? [],
    ),
    [contractorsQuery.data],
  );

  const categoryItems = useMemo(
    () => Object.fromEntries(flatCategories.map((category) => [category.id, category.label])),
    [flatCategories],
  );

  // Aktywne = pola niepuste (puste pole wyszukiwania i domyślne selecty się nie liczą).
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasDateFilters = Boolean(
    filters.dateFrom || filters.dateTo || filters.dueDateFrom || filters.dueDateTo,
  );
  const dictionaryError =
    documentTypesQuery.isError ||
    contractorsQuery.isError ||
    categoriesQuery.isError;

  const update = (key: keyof DocumentsFilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section
      role="region"
      aria-label="Filtry dokumentów"
      className="rounded-xl border bg-card"
    >
      <div className="flex items-center justify-between border-b p-2.5 md:hidden">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-3"
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-document-filters"
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <ListFilter aria-hidden="true" />
          Filtry
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn("transition-transform", mobileFiltersOpen && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {documentsLabel(resultCount)}
        </span>
      </div>

      {/* Wiersz 1 — pasek kontrolek */}
      <div className="flex flex-wrap items-center gap-2.5 p-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="documents-search"
            type="search"
            autoComplete="off"
            aria-label="Szukaj: numer faktury lub kontrahent"
            placeholder="Numer faktury lub kontrahent"
            className={cn(controlHeight, "pl-9")}
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </div>

        <div
          id="mobile-document-filters"
          className={cn("contents", !mobileFiltersOpen && "max-md:hidden")}
        >
        <Select
          value={filters.documentTypeId || null}
          onValueChange={(value) => update("documentTypeId", value ?? "")}
          disabled={documentTypesQuery.isLoading || documentTypesQuery.isError}
          items={docTypeItems}
        >
          <SelectTrigger
            id="document-type-filter"
            aria-label="Typ dokumentu"
            className={cn(controlHeight, "w-full sm:w-[180px]")}
          >
            <SelectValue placeholder={documentTypesQuery.isLoading ? "Ładowanie…" : "Typ dokumentu"} />
          </SelectTrigger>
          <SelectContent className="w-max min-w-(--anchor-width)">
            {documentTypesQuery.data?.map((type: { id: string; name: string }) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.contractorId || null}
          onValueChange={(value) => update("contractorId", value ?? "")}
          disabled={contractorsQuery.isLoading || contractorsQuery.isError}
          items={contractorItems}
        >
          <SelectTrigger
            id="contractor-filter"
            aria-label="Kontrahent"
            className={cn(controlHeight, "w-full sm:w-[180px]")}
          >
            <SelectValue placeholder={contractorsQuery.isLoading ? "Ładowanie…" : "Kontrahent"} />
          </SelectTrigger>
          <SelectContent className="w-max min-w-(--anchor-width)">
            {contractorsQuery.data?.map((contractor: { id: string; name: string }) => (
              <SelectItem key={contractor.id} value={contractor.id}>
                {contractor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.categoryId || null}
          onValueChange={(value) => update("categoryId", value ?? "")}
          disabled={categoriesQuery.isLoading || categoriesQuery.isError}
          items={categoryItems}
        >
          <SelectTrigger
            id="category-filter"
            aria-label="Kategoria"
            className={cn(controlHeight, "w-full sm:w-[170px]")}
          >
            <SelectValue placeholder={categoriesQuery.isLoading ? "Ładowanie…" : "Kategoria"} />
          </SelectTrigger>
          <SelectContent className="w-max min-w-(--anchor-width)">
            {flatCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                aria-label={`Zakresy dat${hasDateFilters ? " (aktywne)" : ""}`}
                className={cn(controlHeight, "px-3")}
              />
            }
          >
            <Calendar className="mr-1 size-4" aria-hidden="true" />
            Zakresy dat
            {hasDateFilters && (
              <span className="ml-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
            )}
            <ChevronDown className="ml-1 size-4 text-muted-foreground" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 gap-4 p-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Data wystawienia</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="issue-date-from" className="text-xs text-muted-foreground">Od</Label>
                  <DateInput
                    id="issue-date-from"
                    max={filters.dateTo || undefined}
                    value={filters.dateFrom}
                    onChange={(v) => update("dateFrom", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="issue-date-to" className="text-xs text-muted-foreground">Do</Label>
                  <DateInput
                    id="issue-date-to"
                    min={filters.dateFrom || undefined}
                    value={filters.dateTo}
                    onChange={(v) => update("dateTo", v)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Termin płatności</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="due-date-from" className="text-xs text-muted-foreground">Od</Label>
                  <DateInput
                    id="due-date-from"
                    max={filters.dueDateTo || undefined}
                    value={filters.dueDateFrom}
                    onChange={(v) => update("dueDateFrom", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-date-to" className="text-xs text-muted-foreground">Do</Label>
                  <DateInput
                    id="due-date-to"
                    min={filters.dueDateFrom || undefined}
                    value={filters.dueDateTo}
                    onChange={(v) => update("dueDateTo", v)}
                  />
                </div>
              </div>
            </fieldset>

            {hasDateFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() =>
                  onChange({
                    ...filters,
                    dateFrom: "",
                    dateTo: "",
                    dueDateFrom: "",
                    dueDateTo: "",
                  })
                }
              >
                <X className="mr-1 size-4" aria-hidden="true" />
                Wyczyść zakresy dat
              </Button>
            )}
          </PopoverContent>
        </Popover>
        </div>
      </div>

      {/* Wiersz 2 — licznik, chip aktywnych filtrów, konfiguracja kolumn */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="hidden text-sm text-muted-foreground tabular-nums md:inline" aria-live="polite">
            {documentsLabel(resultCount)}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => onChange(emptyFilters)}
              aria-label={`Wyczyść wszystkie filtry (aktywne: ${activeFilterCount})`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pr-2 pl-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
            >
              <ListFilter className="size-3.5" aria-hidden="true" />
              {activeFilterCount}{" "}
              {pluralizePl(activeFilterCount, ["aktywny filtr", "aktywne filtry", "aktywnych filtrów"])}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <ColumnConfigDialog />
      </div>

      {dictionaryError && (
        <p className="border-t px-2.5 py-2 text-sm text-destructive" role="alert">
          Nie udało się załadować części opcji filtrów. Odśwież stronę i spróbuj ponownie.
        </p>
      )}
    </section>
  );
}
