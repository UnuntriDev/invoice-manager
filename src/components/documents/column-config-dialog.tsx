"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Settings2, GripVertical } from "lucide-react";
import { useColumnConfig, useUpdateColumnConfig } from "@/lib/hooks/use-documents";
import { COLUMN_LABELS } from "./document-columns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

interface ColumnItem {
  columnKey: string;
  isVisible: boolean;
  position: number;
}

const DEFAULT_VISIBLE_COLUMNS = new Set([
  "invoiceNumber",
  "documentType",
  "contractor",
  "issueDate",
  "dueDate",
  "amountNet",
  "amountVat",
  "amountGross",
  "category",
  "source",
]);

function getDefaultColumnConfig(): ColumnItem[] {
  return Object.keys(COLUMN_LABELS).map((columnKey, position) => ({
    columnKey,
    position,
    isVisible: DEFAULT_VISIBLE_COLUMNS.has(columnKey),
  }));
}

function normalizeColumnConfig(config: ColumnItem[] | undefined): ColumnItem[] {
  return [...(config ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((column) => ({
      columnKey: column.columnKey,
      isVisible: column.isVisible,
      position: column.position,
    }));
}

function SortableItem({
  item,
  onToggle,
}: {
  item: ColumnItem;
  onToggle: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.columnKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border px-3 py-2"
    >
      <button
        type="button"
        className="flex size-9 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Zmień pozycję kolumny ${COLUMN_LABELS[item.columnKey] || item.columnKey}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <Checkbox
        id={`column-visible-${item.columnKey}`}
        checked={item.isVisible}
        onCheckedChange={() => onToggle(item.columnKey)}
      />
      <Label htmlFor={`column-visible-${item.columnKey}`} className="flex-1 cursor-pointer">
        {COLUMN_LABELS[item.columnKey] || item.columnKey}
      </Label>
    </div>
  );
}

export function ColumnConfigDialog() {
  const { data: serverConfig, isLoading, isError } = useColumnConfig();
  const updateConfig = useUpdateColumnConfig();
  const [draftItems, setDraftItems] = useState<ColumnItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const items = draftItems ?? normalizeColumnConfig(serverConfig);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraftItems((draft) => {
      const prev = draft ?? normalizeColumnConfig(serverConfig);
      const oldIndex = prev.findIndex((i) => i.columnKey === active.id);
      const newIndex = prev.findIndex((i) => i.columnKey === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleToggle(key: string) {
    setDraftItems((draft) => {
      const current = draft ?? normalizeColumnConfig(serverConfig);
      const selected = current.find((item) => item.columnKey === key);
      if (
        selected?.isVisible &&
        current.filter((item) => item.isVisible).length === 1
      ) {
        toast.warning("Co najmniej jedna kolumna musi pozostać widoczna");
        return current;
      }
      return current.map((item) =>
        item.columnKey === key
          ? { ...item, isVisible: !item.isVisible }
          : item
      );
    });
  }

  function handleReset() {
    setDraftItems(getDefaultColumnConfig());
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setDraftItems(null);
    setOpen(nextOpen);
  }

  async function handleSave() {
    const columns = items.map((item, index) => ({
      columnKey: item.columnKey,
      isVisible: item.isVisible,
      position: index,
    }));

    try {
      await updateConfig.mutateAsync(columns);
      toast.success("Konfiguracja kolumn zapisana");
      setOpen(false);
    } catch {
      toast.error("Nie udało się zapisać konfiguracji");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Settings2 className="mr-2 h-4 w-4" />
        Kolumny
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfiguracja kolumn</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">
            Ładowanie konfiguracji…
          </p>
        )}
        {isError && (
          <p className="py-8 text-center text-sm text-destructive" role="alert">
            Nie udało się załadować konfiguracji kolumn.
          </p>
        )}
        {!isLoading && !isError && <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.columnKey)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableItem
                  key={item.columnKey}
                  item={item}
                  onToggle={handleToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
          <Button variant="ghost" onClick={handleReset} disabled={isLoading || isError}>
            Przywróć domyślne
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending || isLoading || isError || items.length === 0}
            >
              {updateConfig.isPending ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
