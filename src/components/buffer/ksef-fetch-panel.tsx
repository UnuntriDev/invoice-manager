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
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useKSeFetch } from "@/lib/hooks/use-documents";

export function KSeFetchPanel() {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<string>("COST");
  const fetchKSeF = useKSeFetch();

  async function handleFetch() {
    try {
      const result = await fetchKSeF.mutateAsync({ dateFrom, dateTo, type });
      const parts: string[] = [];
      if (result.imported > 0) parts.push(`Pobrano ${result.imported} faktur do bufora`);
      if (result.skipped > 0) parts.push(`Pominięto ${result.skipped} duplikatów`);
      if (result.errors?.length > 0) parts.push(`${result.errors.length} błędów`);
      toast.success(parts.join(". ") || "Brak nowych faktur");
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
                <Label>Data od</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Data do</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Typ faktur</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "COST")}>
                <SelectTrigger>
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
