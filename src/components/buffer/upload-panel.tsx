"use client";

import { useState, useRef, useCallback } from "react";
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
import { Upload, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useUploadDocument,
  useDocumentTypes,
  useContractors,
} from "@/lib/hooks/use-documents";

export function UploadPanel() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [pdfFields, setPdfFields] = useState({
    invoiceNumber: "",
    documentTypeId: "",
    contractorId: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    amountNet: "",
    amountVat: "",
    amountGross: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadDoc = useUploadDocument();
  const { data: docTypes } = useDocumentTypes();
  const { data: contractors } = useContractors();

  function handleFileSelect(f: File) {
    const maxSize = 10 * 1024 * 1024;
    if (f.size > maxSize) {
      toast.error("Plik jest za duży. Maksymalny rozmiar to 10MB");
      return;
    }
    const allowed = ["application/pdf", "text/xml", "application/xml"];
    if (!allowed.includes(f.type)) {
      toast.error("Dozwolone formaty to PDF i XML");
      return;
    }
    setFile(f);
    setIsPdf(f.type === "application/pdf");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  async function handleUpload() {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    if (isPdf) {
      for (const [key, value] of Object.entries(pdfFields)) {
        if (value) formData.append(key, value);
      }
    }

    try {
      await uploadDoc.mutateAsync(formData);
      toast.success("Dokument dodany do bufora");
      resetAndClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd uploadu");
    }
  }

  function resetAndClose() {
    setFile(null);
    setIsPdf(false);
    setPdfFields({
      invoiceNumber: "",
      documentTypeId: "",
      contractorId: "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      amountNet: "",
      amountVat: "",
      amountGross: "",
    });
    setOpen(false);
  }

  function updatePdf(key: string, value: string) {
    setPdfFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Wgraj plik
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else setOpen(true); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload dokumentu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!file ? (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Przeciągnij plik lub kliknij
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF lub XML (max 10MB)
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {file.type.includes("pdf") ? "PDF" : "XML"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFile(null); setIsPdf(false); }}
                >
                  Zmień
                </Button>
              </div>
            )}

            {file && isPdf && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Plik PDF — uzupełnij dane ręcznie
                </p>
                <div className="space-y-1">
                  <Label>Numer faktury *</Label>
                  <Input
                    value={pdfFields.invoiceNumber}
                    onChange={(e) => updatePdf("invoiceNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Typ dokumentu *</Label>
                  <Select
                    value={pdfFields.documentTypeId || null}
                    onValueChange={(v) => updatePdf("documentTypeId", v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ" />
                    </SelectTrigger>
                    <SelectContent>
                      {docTypes?.map((t: { id: string; name: string }) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Kontrahent *</Label>
                  <Select
                    value={pdfFields.contractorId || null}
                    onValueChange={(v) => updatePdf("contractorId", v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kontrahenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors?.map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Data wystawienia</Label>
                    <Input
                      type="date"
                      value={pdfFields.issueDate}
                      onChange={(e) => updatePdf("issueDate", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Termin płatności</Label>
                    <Input
                      type="date"
                      value={pdfFields.dueDate}
                      onChange={(e) => updatePdf("dueDate", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Netto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pdfFields.amountNet}
                      onChange={(e) => updatePdf("amountNet", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>VAT</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pdfFields.amountVat}
                      onChange={(e) => updatePdf("amountVat", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Brutto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pdfFields.amountGross}
                      onChange={(e) => updatePdf("amountGross", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {file && !isPdf && (
              <p className="text-sm text-muted-foreground">
                Plik XML zostanie automatycznie sparsowany. Dane faktury zostaną
                wypełnione na podstawie zawartości pliku.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>
                Anuluj
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploadDoc.isPending}
              >
                {uploadDoc.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Wgraj do bufora
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
