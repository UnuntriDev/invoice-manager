"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Building2, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useContractors,
  useCreateContractor,
  useUpdateContractor,
  useDeleteContractor,
  useCategories,
} from "@/lib/hooks/use-documents";
import { contractorCreateSchema } from "@/lib/validators/schemas";
import { flattenCategories } from "@/lib/categories";
import { QueryErrorState } from "@/components/query-error-state";
import { useNotifications } from "@/components/notification-context";

interface Contractor {
  id: string;
  name: string;
  nip: string;
  address: string | null;
  bankAccountNumber: string | null;
  defaultCategoryId: string | null;
  defaultCategory: { id: string; name: string } | null;
}

async function copyContractorValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Skopiowano ${label}`);
  } catch {
    toast.error(`Nie udało się skopiować: ${label}`);
  }
}

function ContractorsPageContent() {
  const searchParams = useSearchParams();
  const pageRouter = useRouter();
  const contractorsQuery = useContractors();
  const {
    data: contractors,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = contractorsQuery;
  const { data: categories } = useCategories();
  const createMut = useCreateContractor();
  const updateMut = useUpdateContractor();
  const deleteMut = useDeleteContractor();
  const { add: addNotification } = useNotifications();

  const actionAdd = searchParams.get("action") === "add";
  const [formOpen, setFormOpen] = useState(actionAdd);

  useEffect(() => {
    if (actionAdd) pageRouter.replace("/contractors");
  }, [actionAdd, pageRouter]);

  const [editing, setEditing] = useState<Contractor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contractor | null>(null);

  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);

  const flatCats = useMemo(
    () => (categories ? flattenCategories(categories) : []),
    [categories],
  );

  const categoryItems = useMemo(
    () => ({ none: "Brak", ...Object.fromEntries(flatCats.map((c) => [c.id, c.label])) }),
    [flatCats],
  );

  function openNew() {
    setEditing(null);
    setName("");
    setNip("");
    setAddress("");
    setBankAccountNumber("");
    setDefaultCategoryId(null);
    setFormOpen(true);
  }

  function openEdit(c: Contractor) {
    setEditing(c);
    setName(c.name);
    setNip(c.nip);
    setAddress(c.address ?? "");
    setBankAccountNumber(c.bankAccountNumber ?? "");
    setDefaultCategoryId(c.defaultCategoryId);
    setFormOpen(true);
  }

  async function handleSubmit() {
    const validation = contractorCreateSchema.safeParse({
      name,
      nip,
      address: address || null,
      bankAccountNumber: bankAccountNumber || null,
      defaultCategoryId: defaultCategoryId || null,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Popraw dane kontrahenta");
      return;
    }
    const data = validation.data;

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data });
        toast.success("Kontrahent zaktualizowany");
        addNotification({ title: "Kontrahent zaktualizowany", description: data.name });
      } else {
        await createMut.mutateAsync(data);
        toast.success("Kontrahent dodany");
        addNotification({ title: "Kontrahent dodany", description: data.name });
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystąpił błąd");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("Kontrahent usunięty");
      addNotification({ title: "Kontrahent usunięty", description: deleteTarget.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie można usunąć kontrahenta");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Kontrahenci</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Zarządzaj kontrahentami i ich domyślnymi kategoriami
          </p>
        </div>
        <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj kontrahenta
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {contractors?.length ?? 0} kontrahentów
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState
          title="Nie udało się pobrać kontrahentów"
          error={error}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : !contractors?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Brak kontrahentów</p>
          <p className="text-xs text-muted-foreground">Dodaj pierwszego kontrahenta</p>
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden" aria-label="Lista kontrahentów">
          {(contractors as Contractor[]).map((contractor) => (
            <article
              key={contractor.id}
              className="rounded-xl border border-border bg-card p-4 dark:border-white/15"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">{contractor.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {contractor.defaultCategory?.name ?? "Brak domyślnej kategorii"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="size-11"
                    onClick={() => openEdit(contractor)}
                    aria-label={`Edytuj kontrahenta ${contractor.name}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="size-11 text-destructive"
                    onClick={() => setDeleteTarget(contractor)}
                    aria-label={`Usuń kontrahenta ${contractor.name}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <dl className="mt-4 space-y-3 border-t pt-3">
                <div>
                  <dt className="text-xs text-muted-foreground">NIP</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{contractor.nip}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="size-11"
                      onClick={() => void copyContractorValue(contractor.nip, "NIP")}
                      aria-label={`Kopiuj NIP kontrahenta ${contractor.name}`}
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Adres</dt>
                  <dd className="mt-1 text-sm">{contractor.address ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Numer rachunku</dt>
                  <dd className="mt-1 flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs">
                      {contractor.bankAccountNumber ?? "—"}
                    </span>
                    {contractor.bankAccountNumber && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        className="size-11 shrink-0"
                        onClick={() =>
                          void copyContractorValue(contractor.bankAccountNumber!, "numer rachunku")
                        }
                        aria-label={`Kopiuj numer rachunku kontrahenta ${contractor.name}`}
                      >
                        <Copy aria-hidden="true" />
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-md border border-border dark:border-white/15 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead>Nr rachunku</TableHead>
                <TableHead>Domyślna kategoria</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contractors as Contractor[]).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">{c.nip}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => void copyContractorValue(c.nip, "NIP")}
                                aria-label={`Kopiuj NIP kontrahenta ${c.name}`}
                              />
                            }
                          >
                            <Copy aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Kopiuj NIP</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 text-sm">
                    {c.address ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger render={<span />} className="block truncate">
                            {c.address}
                          </TooltipTrigger>
                          <TooltipContent>{c.address}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-36 font-mono text-xs">
                    {c.bankAccountNumber ? (
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={<span />}
                              className="block min-w-0 cursor-default truncate"
                            >
                              {c.bankAccountNumber}
                            </TooltipTrigger>
                            <TooltipContent>{c.bankAccountNumber}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0"
                                  onClick={() =>
                                    void copyContractorValue(c.bankAccountNumber!, "numer rachunku")
                                  }
                                  aria-label={`Kopiuj numer rachunku kontrahenta ${c.name}`}
                                />
                              }
                            >
                              <Copy aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent>Kopiuj numer rachunku</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.defaultCategory?.name ?? "—"}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(c)}
                                aria-label={`Edytuj kontrahenta ${c.name}`}
                              />
                            }
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Edytuj</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => setDeleteTarget(c)}
                                aria-label={`Usuń kontrahenta ${c.name}`}
                              />
                            }
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Usuń</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edytuj kontrahenta" : "Dodaj kontrahenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="contractor-name">Nazwa <span className="text-destructive">*</span></Label>
              <Input id="contractor-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractor-nip">NIP <span className="text-destructive">*</span></Label>
              <Input
                id="contractor-nip"
                value={nip}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
                  setNip(parts.filter(Boolean).join(" "));
                }}
                placeholder="000 000 00 00"
                maxLength={13}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractor-address">Adres</Label>
              <Input id="contractor-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractor-bank-account">Numer rachunku bankowego</Label>
              <Input
                id="contractor-bank-account"
                value={bankAccountNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 26);
                  let fmt = digits.slice(0, 2);
                  for (let i = 2; i < digits.length; i += 4) {
                    fmt += " " + digits.slice(i, i + 4);
                  }
                  setBankAccountNumber(fmt);
                }}
                placeholder="00 0000 0000 0000 0000 0000 0000"
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contractor-default-category">Domyślna kategoria</Label>
              <Select
                value={defaultCategoryId ?? "none"}
                onValueChange={(v) => setDefaultCategoryId(v === "none" ? null : v)}
                items={categoryItems}
              >
                <SelectTrigger id="contractor-default-category" className="w-full">
                  <SelectValue placeholder="Brak" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  collisionPadding={8}
                  collisionAvoidance={{
                    side: "none",
                    align: "shift",
                    fallbackAxisSide: "none",
                  }}
                  className="max-h-[min(18rem,var(--available-height))] overscroll-contain"
                >
                  <SelectItem value="none">Brak</SelectItem>
                  {flatCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name || !nip || createMut.isPending || updateMut.isPending}
              >
                {editing ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć kontrahenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Kontrahent &quot;{deleteTarget?.name}&quot; zostanie trwale usunięty. Operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ContractorsPage() {
  return (
    <Suspense fallback={null}>
      <ContractorsPageContent />
    </Suspense>
  );
}
