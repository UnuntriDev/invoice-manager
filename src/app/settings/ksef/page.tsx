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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useKSeFSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useRunSchedule,
} from "@/lib/hooks/use-documents";
import { ksefScheduleSchema } from "@/lib/validators/schemas";
import { CRON_TIME_ZONE } from "@/lib/cron/timezone";
import { QueryErrorState } from "@/components/query-error-state";
import { useNotifications } from "@/components/notification-context";

interface Schedule {
  id: string;
  hour: number;
  minute: number;
  fetchType: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface RunResult {
  status: "success" | "skipped" | "failed";
  error?: string;
}

const scheduleDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: CRON_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fetchTypeLabels: Record<string, string> = {
  COST: "Kosztowe",
  SALES: "Sprzedażowe",
  BOTH: "Oba typy",
};

export default function KSeFSettingsPage() {
  const {
    data: schedules,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useKSeFSchedules();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const runSchedule = useRunSchedule();
  const { add: addNotification } = useNotifications();

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
    const validation = ksefScheduleSchema.safeParse({
      hour,
      minute,
      fetchType,
      isActive,
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Popraw dane harmonogramu");
      return;
    }
    const data = validation.data;
    try {
      if (editId) {
        await updateSchedule.mutateAsync({ id: editId, data });
        toast.success("Harmonogram zaktualizowany");
        addNotification({ title: "Harmonogram zaktualizowany", description: `${data.hour}:${String(data.minute).padStart(2, "0")}` });
      } else {
        await createSchedule.mutateAsync(data);
        toast.success("Harmonogram dodany");
        addNotification({ title: "Harmonogram dodany", description: `${data.hour}:${String(data.minute).padStart(2, "0")}` });
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
      addNotification({ title: "Harmonogram usunięty", description: "" });
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

  async function handleRun(id: string) {
    try {
      const result = (await runSchedule.mutateAsync(id)) as RunResult;
      if (result.status === "success") {
        toast.success("Harmonogram wykonany poprawnie");
        addNotification({ title: "Harmonogram KSeF wykonany", description: "Pobieranie zakończone" });
      } else if (result.status === "skipped") {
        toast.info("Harmonogram jest już wykonywany lub jest nieaktywny");
      } else {
        toast.error(result.error || "Wykonanie harmonogramu nie powiodło się");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd wykonania");
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Harmonogram KSeF</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Konfiguracja automatycznego pobierania faktur (strefa {CRON_TIME_ZONE})
          </p>
        </div>
        <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={openNew}>
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
      ) : isError ? (
        <QueryErrorState
          title="Nie udało się pobrać harmonogramów"
          error={error}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
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
                <TableHead>Ostatni błąd</TableHead>
                <TableHead className="w-32">Akcje</TableHead>
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
                      aria-label={`${s.isActive ? "Wyłącz" : "Włącz"} harmonogram ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.lastRunAt
                      ? scheduleDateFormatter.format(new Date(s.lastRunAt))
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-72 text-sm">
                    {s.lastError ? (
                      <span className="text-destructive" title={s.lastError}>
                        {s.lastError}
                        {s.lastErrorAt
                          ? ` (${scheduleDateFormatter.format(new Date(s.lastErrorAt))})`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Brak</span>
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
                                aria-label={`Uruchom harmonogram ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                                disabled={!s.isActive || runSchedule.isPending}
                                onClick={() => handleRun(s.id)}
                              />
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {s.isActive ? "Uruchom teraz" : "Harmonogram nieaktywny"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(s)}
                                aria-label={`Edytuj harmonogram ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                              />
                            }
                          >
                            <Pencil className="h-4 w-4" />
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
                                onClick={() => handleDelete(s.id)}
                                aria-label={`Usuń harmonogram ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                              />
                            }
                          >
                            <Trash2 className="h-4 w-4" />
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
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edytuj harmonogram" : "Nowy harmonogram"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="schedule-hour">Godzina</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="schedule-hour"
                  type="number"
                  min={0}
                  max={23}
                  className="w-16 text-center font-mono"
                  value={String(hour).padStart(2, "0")}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                    setHour(v);
                  }}
                />
                <span className="text-lg font-semibold">:</span>
                <Input
                  id="schedule-minute"
                  aria-label="Minuta"
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  className="w-16 text-center font-mono"
                  value={String(minute).padStart(2, "0")}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                    setMinute(v);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="schedule-fetch-type">Typ faktur</Label>
              <Select value={fetchType} onValueChange={(v) => setFetchType(v ?? "BOTH")} items={{ COST: "Kosztowe (zakup)", SALES: "Sprzedażowe", BOTH: "Oba typy" }}>
                <SelectTrigger id="schedule-fetch-type">
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
              <Switch id="schedule-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="schedule-active">Aktywny</Label>
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
