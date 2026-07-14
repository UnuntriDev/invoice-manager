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
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  useKSeFSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from "@/lib/hooks/use-documents";

interface Schedule {
  id: string;
  hour: number;
  minute: number;
  fetchType: string;
  isActive: boolean;
  lastRunAt: string | null;
}

const fetchTypeLabels: Record<string, string> = {
  COST: "Kosztowe",
  SALES: "Sprzedażowe",
  BOTH: "Oba typy",
};

export default function KSeFSettingsPage() {
  const { data: schedules, isLoading } = useKSeFSchedules();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [fetchType, setFetchType] = useState("BOTH");
  const [isActive, setIsActive] = useState(true);

  function openNew() {
    setEditId(null);
    setHour(6);
    setMinute(0);
    setFetchType("BOTH");
    setIsActive(true);
    setFormOpen(true);
  }

  function openEdit(s: Schedule) {
    setEditId(s.id);
    setHour(s.hour);
    setMinute(s.minute);
    setFetchType(s.fetchType);
    setIsActive(s.isActive);
    setFormOpen(true);
  }

  async function handleSave() {
    const data = { hour, minute, fetchType, isActive };
    try {
      if (editId) {
        await updateSchedule.mutateAsync({ id: editId, data });
        toast.success("Harmonogram zaktualizowany");
      } else {
        await createSchedule.mutateAsync(data);
        toast.success("Harmonogram dodany");
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zapisu");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSchedule.mutateAsync(id);
      toast.success("Harmonogram usunięty");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  async function handleToggle(s: Schedule) {
    try {
      await updateSchedule.mutateAsync({
        id: s.id,
        data: { hour: s.hour, minute: s.minute, fetchType: s.fetchType, isActive: !s.isActive },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd aktualizacji");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Harmonogram KSeF</h1>
          <p className="text-sm text-muted-foreground">
            Konfiguracja automatycznego pobierania faktur
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj harmonogram
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !schedules?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clock className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Brak harmonogramów</h3>
          <p className="text-sm">Dodaj harmonogram automatycznego pobierania faktur z KSeF</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Godzina</TableHead>
                <TableHead>Typ faktur</TableHead>
                <TableHead>Aktywny</TableHead>
                <TableHead>Ostatnie uruchomienie</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s: Schedule) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-medium">
                    {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}
                  </TableCell>
                  <TableCell>{fetchTypeLabels[s.fetchType] || s.fetchType}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={() => handleToggle(s)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.lastRunAt
                      ? format(new Date(s.lastRunAt), "dd.MM.yyyy HH:mm", { locale: pl })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edytuj harmonogram" : "Nowy harmonogram"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Godzina (0-23)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label>Minuta (0-59)</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Typ faktur</Label>
              <Select value={fetchType} onValueChange={(v) => setFetchType(v ?? "BOTH")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COST">Kosztowe (zakup)</SelectItem>
                  <SelectItem value="SALES">Sprzedażowe</SelectItem>
                  <SelectItem value="BOTH">Oba typy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Aktywny</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleSave}
                disabled={createSchedule.isPending || updateSchedule.isPending}
              >
                {editId ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
