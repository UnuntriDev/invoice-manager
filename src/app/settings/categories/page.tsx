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
  Plus,
  Pencil,
  Trash2,
  FolderTree,
  ChevronRight,
  ChevronDown,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/lib/hooks/use-documents";
import { categoryCreateSchema } from "@/lib/validators/schemas";
import { flattenCategories, type CategoryNode } from "@/lib/categories";
import { QueryErrorState } from "@/components/query-error-state";
import { useNotifications } from "@/components/notification-context";

function TreeNode({
  node,
  level,
  onAdd,
  onEdit,
  onDelete,
}: {
  node: CategoryNode;
  level: number;
  onAdd: (parentId: string) => void;
  onEdit: (cat: CategoryNode) => void;
  onDelete: (cat: CategoryNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
          disabled={!hasChildren}
          aria-label={hasChildren ? `${expanded ? "Zwiń" : "Rozwiń"} kategorię ${node.name}` : undefined}
          aria-expanded={hasChildren ? expanded : undefined}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        <span className="flex-1 text-sm font-medium">{node.name}</span>

        {(node._count?.documents ?? 0) > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {node._count!.documents}
          </span>
        )}

        <div className="flex gap-0.5 text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onAdd(node.id)}
            title="Dodaj podkategorię"
            aria-label={`Dodaj podkategorię do ${node.name}`}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onEdit(node)}
            title="Edytuj"
            aria-label={`Edytuj kategorię ${node.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive"
            onClick={() => onDelete(node)}
            title="Usuń"
            aria-label={`Usuń kategorię ${node.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriesPageContent() {
  const searchParams = useSearchParams();
  const pageRouter = useRouter();
  const {
    data: categories,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { add: addNotification } = useNotifications();

  const actionAdd = searchParams.get("action") === "add";
  const [formOpen, setFormOpen] = useState(actionAdd);

  useEffect(() => {
    if (actionAdd) pageRouter.replace("/settings/categories");
  }, [actionAdd, pageRouter]);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

  const tree = useMemo(
    () => (categories ?? []) as CategoryNode[],
    [categories],
  );

  function openNew(presetParentId?: string) {
    setEditId(null);
    setName("");
    setParentId(presetParentId || null);
    setFormOpen(true);
  }

  function openEdit(cat: CategoryNode) {
    setEditId(cat.id);
    setName(cat.name);
    setParentId(cat.parentId);
    setFormOpen(true);
  }

  async function handleSave() {
    const validation = categoryCreateSchema.safeParse({ name, parentId });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Popraw dane kategorii");
      return;
    }
    const data = validation.data;
    try {
      if (editId) {
        await updateCategory.mutateAsync({ id: editId, data });
        toast.success("Kategoria zaktualizowana");
        addNotification({ title: "Kategoria zaktualizowana", description: data.name });
      } else {
        await createCategory.mutateAsync(data);
        toast.success("Kategoria dodana");
        addNotification({ title: "Kategoria dodana", description: data.name });
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zapisu");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      toast.success("Kategoria usunięta");
      addNotification({ title: "Kategoria usunięta", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  const parentOptions = useMemo(
    () => flattenCategories(tree, { prefix: "  └ ", excludeId: editId || undefined }),
    [tree, editId],
  );

  const parentItems = useMemo(
    () => ({ none: "Brak (kategoria główna)", ...Object.fromEntries(parentOptions.map((opt) => [opt.id, opt.label])) }),
    [parentOptions],
  );

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Kategorie</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Drzewo kategorii dokumentów
          </p>
        </div>
        <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj kategorię
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState
          title="Nie udało się pobrać kategorii"
          error={error}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : !tree.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderTree className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Brak kategorii</h3>
          <p className="text-sm">Dodaj pierwszą kategorię dokumentów</p>
        </div>
      ) : (
        <div className="rounded-md border">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              onAdd={(pid) => openNew(pid)}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edytuj kategorię" : "Nowa kategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="category-name">Nazwa <span className="text-destructive">*</span></Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Koszty operacyjne"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category-parent">Kategoria nadrzędna</Label>
              <Select
                value={parentId ?? "none"}
                onValueChange={(v) => setParentId(v === "none" ? null : v)}
                items={parentItems}
              >
                <SelectTrigger id="category-parent">
                  <SelectValue placeholder="Brak (kategoria główna)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak (kategoria główna)</SelectItem>
                  {parentOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !name.trim() ||
                  createCategory.isPending ||
                  updateCategory.isPending
                }
              >
                {editId ? "Zapisz zmiany" : "Dodaj"}
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
            <AlertDialogTitle>Usunąć kategorię?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć kategorię &quot;{deleteTarget?.name}
              &quot;? Tej operacji nie można cofnąć.
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

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesPageContent />
    </Suspense>
  );
}
