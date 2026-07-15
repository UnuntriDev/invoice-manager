"use client";

import { useState } from "react";
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
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  useContractors,
  useCreateContractor,
  useUpdateContractor,
  useDeleteContractor,
  useCategories,
} from "@/lib/hooks/use-documents";
import { contractorCreateSchema } from "@/lib/validators/schemas";

interface Contractor {
  id: string;
  name: string;
  nip: string;
  address: string | null;
  bankAccountNumber: string | null;
  defaultCategoryId: string | null;
  defaultCategory: { id: string; name: string } | null;
}

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
}

function flattenCategories(cats: CategoryNode[], depth = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const cat of cats) {
    result.push({ id: cat.id, label: "  ".repeat(depth) + cat.name });
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return result;
}

export default function ContractorsPage() {
  const { data: contractors, isLoading } = useContractors();
  const { data: categories } = useCategories();
  const createMut = useCreateContractor();
  const updateMut = useUpdateContractor();
  const deleteMut = useDeleteContractor();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contractor | null>(null);

  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);

  const flatCats = categories ? flattenCategories(categories) : [];

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
      } else {
        await createMut.mutateAsync(data);
        toast.success("Kontrahent dodany");
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie można usunąć kontrahenta");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Kontrahenci</h1>
        <p className="text-sm text-muted-foreground">
          Zarządzaj kontrahentami i ich domyślnymi kategoriami
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button onClick={openNew}>
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
      ) : !contractors?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Brak kontrahentów</p>
          <p className="text-xs text-muted-foreground">Dodaj pierwszego kontrahenta</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
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
                  <TableCell className="font-mono text-sm">{c.nip}</TableCell>
                  <TableCell className="max-w-48 truncate text-sm">{c.address ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.bankAccountNumber ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.defaultCategory?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edytuj kontrahenta" : "Dodaj kontrahenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Nazwa *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>NIP *</Label>
              <Input
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="10 cyfr"
                maxLength={10}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1">
              <Label>Adres</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Numer rachunku bankowego</Label>
              <Input
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="26 cyfr"
              />
            </div>
            <div className="space-y-1">
              <Label>Domyślna kategoria</Label>
              <Select
                value={defaultCategoryId ?? "none"}
                onValueChange={(v) => setDefaultCategoryId(v === "none" ? null : v)}
                items={{ none: "Brak", ...Object.fromEntries(flatCats.map((c) => [c.id, c.label])) }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Brak" />
                </SelectTrigger>
                <SelectContent>
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
            <AlertDialogAction onClick={handleDelete}>Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
