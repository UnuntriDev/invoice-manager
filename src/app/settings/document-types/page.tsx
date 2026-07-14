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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, FileType2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
} from "@/lib/hooks/use-documents";

interface DocType {
  id: string;
  name: string;
  direction: string;
  isSystem: boolean;
}

const directionLabels: Record<string, string> = {
  RECEIVABLE: "Należność (sprzedaż)",
  PAYABLE: "Zobowiązanie (zakup)",
};

export default function DocumentTypesPage() {
  const { data: types, isLoading } = useDocumentTypes();
  const createType = useCreateDocumentType();
  const updateType = useUpdateDocumentType();
  const deleteType = useDeleteDocumentType();

  const [formOpen, setFormOpen] = useState(false);
  const [editType, setEditType] = useState<DocType | null>(null);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState("PAYABLE");
  const [deleteTarget, setDeleteTarget] = useState<DocType | null>(null);

  function openNew() {
    setEditType(null);
    setName("");
    setDirection("PAYABLE");
    setFormOpen(true);
  }

  function openEdit(t: DocType) {
    setEditType(t);
    setName(t.name);
    setDirection(t.direction);
    setFormOpen(true);
  }

  async function handleSave() {
    try {
      if (editType) {
        await updateType.mutateAsync({ id: editType.id, data: { name } });
        toast.success("Typ dokumentu zaktualizowany");
      } else {
        await createType.mutateAsync({ name, direction });
        toast.success("Typ dokumentu dodany");
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zapisu");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteType.mutateAsync(deleteTarget.id);
      toast.success("Typ dokumentu usunięty");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  const docTypes: DocType[] = types || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Typy dokumentów</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzaj typami faktur i dokumentów księgowych
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj typ
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !docTypes.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileType2 className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Brak typów dokumentów</h3>
          <p className="text-sm">Dodaj pierwszy typ dokumentu</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>Kierunek</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docTypes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.direction === "RECEIVABLE" ? "default" : "secondary"
                      }
                    >
                      {directionLabels[t.direction] || t.direction}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.isSystem && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Systemowy
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {t.isSystem ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={<span />}
                              className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-md opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Typ systemowy — nie można usunąć
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editType ? "Edytuj typ dokumentu" : "Nowy typ dokumentu"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nazwa *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Faktura VAT"
              />
            </div>
            {editType ? (
              <div className="space-y-1">
                <Label>Kierunek</Label>
                <p className="text-sm text-muted-foreground">
                  {directionLabels[direction]} — nie można zmienić po utworzeniu
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Kierunek *</Label>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v ?? "PAYABLE")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYABLE">
                      Zobowiązanie (zakup)
                    </SelectItem>
                    <SelectItem value="RECEIVABLE">
                      Należność (sprzedaż)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !name.trim() ||
                  createType.isPending ||
                  updateType.isPending
                }
              >
                {editType ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć typ dokumentu?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć typ &quot;{deleteTarget?.name}&quot;?
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
