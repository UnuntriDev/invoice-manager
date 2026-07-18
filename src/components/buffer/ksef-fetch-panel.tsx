"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
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
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useKSeFetch } from "@/lib/hooks/use-documents";
import { ksefFetchSchema } from "@/lib/validators/schemas";
import { formatZonedIsoDate } from "@/lib/cron/timezone";
import { useNotifications } from "@/components/notification-context";

export function KSeFetchPanel() {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatZonedIsoDate(d);
  });
  const [dateTo, setDateTo] = useState(() => formatZonedIsoDate(new Date()));
  const [type, setType] = useState<string>("COST");
  const fetchKSeF = useKSeFetch();
  const { add: addNotification } = useNotifications();

  async function handleFetch() {
    const validation = ksefFetchSchema.safeParse({ dateFrom, dateTo, type });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Popraw zakres pobierania");
      return;
    }

    try {
      const result = await fetchKSeF.mutateAsync({ dateFrom, dateTo, type });
      const importedN = result.imported;
      const skippedN = result.skipped;
      if (importedN === 0 && skippedN === 0) {
        toast.success("Brak nowych faktur");
      } else {
        const importLabel = importedN === 1 ? "fakturę" : importedN >= 2 && importedN <= 4 ? "faktury" : "faktur";
        const skipLabel = skippedN === 1 ? "duplikat" : skippedN >= 2 && skippedN <= 4 ? "duplikaty" : "duplikatów";
        const title = importedN > 0 ? `Pobrano ${importedN} ${importLabel} do bufora` : `Pominięto ${skippedN} ${skipLabel}`;
        const desc = importedN > 0 && skippedN > 0 ? `Pominięto ${skippedN} ${skipLabel}` : undefined;
        toast.success(title, { description: desc });
        if (importedN > 0) {
          addNotification({ title: `KSeF: pobrano ${importedN} ${importLabel}`, description: `Zakres: ${dateFrom} – ${dateTo}` });
        }
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd pobierania z KSeF");
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Pobierz z KSeF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pobieranie faktur z KSeF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ksef-date-from">Data od</Label>
                <DateInput
                  id="ksef-date-from"
                  value={dateFrom}
                  onChange={setDateFrom}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ksef-date-to">Data do</Label>
                <DateInput
                  id="ksef-date-to"
                  value={dateTo}
                  onChange={setDateTo}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ksef-fetch-type">Typ faktur</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v ?? "COST")}
                items={{ COST: "Kosztowe (zakup)", SALES: "Sprzedażowe" }}
              >
                <SelectTrigger id="ksef-fetch-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COST">Kosztowe (zakup)</SelectItem>
                  <SelectItem value="SALES">Sprzedażowe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Anuluj
              </Button>
              <Button onClick={handleFetch} disabled={fetchKSeF.isPending}>
                {fetchKSeF.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pobieranie...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Pobierz
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
