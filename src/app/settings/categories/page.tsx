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

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  _count: { documents: number; children: number };
  children: CategoryNode[];
}

function flattenCategories(
  nodes: CategoryNode[],
  excludeId?: string,
  prefix = ""
): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    result.push({ id: node.id, label: prefix + node.name });
    if (node.children?.length) {
      result.push(
        ...flattenCategories(node.children, excludeId, prefix + "  └ ")
      );
    }
  }
  return result;
}

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
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted/50"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className="flex h-5 w-5 shrink-0 items-center justify-center"
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

        {node._count.documents > 0 && (
          <span className="mr-2 text-xs text-muted-foreground">
            {node._count.documents} dok.
          </span>
        )}

        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onAdd(node.id)}
            title="Dodaj podkategorię"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(node)}
            title="Edytuj"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => onDelete(node)}
            title="Usuń"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
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

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

  const tree: CategoryNode[] = categories || [];

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
    const data = { name, parentId };
    try {
      if (editId) {
        await updateCategory.mutateAsync({ id: editId, data });
        toast.success("Kategoria zaktualizowana");
      } else {
        await createCategory.mutateAsync(data);
        toast.success("Kategoria dodana");
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
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  const parentOptions = flattenCategories(tree, editId || undefined);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategorie</h1>
          <p className="text-sm text-muted-foreground">
            Drzewo kategorii dokumentów
          </p>
        </div>
        <Button onClick={() => openNew()}>
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
              <Label>Nazwa *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Koszty operacyjne"
              />
            </div>
            <div className="space-y-1">
              <Label>Kategoria nadrzędna</Label>
              <Select
                value={parentId ?? "none"}
                onValueChange={(v) => setParentId(v === "none" ? null : v)}
              >
                <SelectTrigger>
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
