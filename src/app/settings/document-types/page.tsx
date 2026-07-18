"use client";

import { Suspense, useEffect, useState } from "react";
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
import {
  documentTypeCreateSchema,
  documentTypeUpdateSchema,
} from "@/lib/validators/schemas";
import { QueryErrorState } from "@/components/query-error-state";
import { useNotifications } from "@/components/notification-context";

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

function DocumentTypesPageContent() {
  const searchParams = useSearchParams();
  const pageRouter = useRouter();
  const {
    data: types,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDocumentTypes();
  const createType = useCreateDocumentType();
  const updateType = useUpdateDocumentType();
  const deleteType = useDeleteDocumentType();
  const { add: addNotification } = useNotifications();

  const actionAdd = searchParams.get("action") === "add";
  const [formOpen, setFormOpen] = useState(actionAdd);

  useEffect(() => {
    if (actionAdd) pageRouter.replace("/settings/document-types");
  }, [actionAdd, pageRouter]);
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
        const validation = documentTypeUpdateSchema.safeParse({ name });
        if (!validation.success) {
          toast.error(validation.error.issues[0]?.message ?? "Popraw dane typu dokumentu");
          return;
        }
        await updateType.mutateAsync({ id: editType.id, data: validation.data });
        toast.success("Typ dokumentu zaktualizowany");
        addNotification({ title: "Typ dokumentu zaktualizowany", description: name });
      } else {
        const validation = documentTypeCreateSchema.safeParse({ name, direction });
        if (!validation.success) {
          toast.error(validation.error.issues[0]?.message ?? "Popraw dane typu dokumentu");
          return;
        }
        await createType.mutateAsync(validation.data);
        toast.success("Typ dokumentu dodany");
        addNotification({ title: "Typ dokumentu dodany", description: name });
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
      addNotification({ title: "Typ dokumentu usunięty", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  const docTypes: DocType[] = types || [];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Typy dokumentów</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Zarządzaj typami faktur i dokumentów księgowych
          </p>
        </div>
        <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={openNew}>
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
      ) : isError ? (
        <QueryErrorState
          title="Nie udało się pobrać typów dokumentów"
          error={error}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
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
                        t.direction === "RECEIVABLE" ? "outline" : "secondary"
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
                    <TooltipProvider>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(t)}
                                aria-label={`Edytuj typ dokumentu ${t.name}`}
                              />
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Edytuj</TooltipContent>
                        </Tooltip>
                        {t.isSystem ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={<span />}
                              className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-md opacity-50"
                              aria-label={`Nie można usunąć systemowego typu ${t.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Typ systemowy, nie można usunąć
                            </TooltipContent>
                          </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => setDeleteTarget(t)}
                                aria-label={`Usuń typ dokumentu ${t.name}`}
                              />
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Usuń</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TooltipProvider>
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
              <Label htmlFor="document-type-name">Nazwa <span className="text-destructive">*</span></Label>
              <Input
                id="document-type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Faktura VAT"
              />
            </div>
            {editType ? (
              <div className="space-y-1">
                <Label>Kierunek</Label>
                <p className="text-sm text-muted-foreground">
                  {directionLabels[direction]} (nie można zmienić po utworzeniu)
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="document-type-direction">Kierunek <span className="text-destructive">*</span></Label>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v ?? "PAYABLE")}
                  items={{ PAYABLE: "Zobowiązanie (zakup)", RECEIVABLE: "Należność (sprzedaż)" }}
                >
                  <SelectTrigger id="document-type-direction">
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
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DocumentTypesPage() {
  return (
    <Suspense fallback={null}>
      <DocumentTypesPageContent />
    </Suspense>
  );
}
