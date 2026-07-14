"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={item.isVisible}
        onCheckedChange={() => onToggle(item.columnKey)}
      />
      <span className="text-sm">
        {COLUMN_LABELS[item.columnKey] || item.columnKey}
      </span>
    </div>
  );
}

export function ColumnConfigDialog() {
  const { data: serverConfig } = useColumnConfig();
  const updateConfig = useUpdateColumnConfig();
  const [items, setItems] = useState<ColumnItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (serverConfig) {
      setItems(
        [...serverConfig]
          .sort((a: ColumnItem, b: ColumnItem) => a.position - b.position)
          .map((c: ColumnItem) => ({
            columnKey: c.columnKey,
            isVisible: c.isVisible,
            position: c.position,
          }))
      );
    }
  }, [serverConfig]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.columnKey === active.id);
      const newIndex = prev.findIndex((i) => i.columnKey === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleToggle(key: string) {
    setItems((prev) =>
      prev.map((i) => (i.columnKey === key ? { ...i, isVisible: !i.isVisible } : i))
    );
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="mr-2 h-4 w-4" />
        Kolumny
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfiguracja kolumn</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
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
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            Zapisz
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
