"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  useUploadDocument,
  useExtractPdfDocument,
  useDocumentTypes,
  useContractors,
  useUploadConfig,
} from "@/lib/hooks/use-documents";
import { pdfUploadSchema } from "@/lib/validators/schemas";
import {
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  getUploadFileValidationError,
} from "@/lib/validators/upload";
import {
  calculateGrossFromRate,
  calculateVatAmount,
  inferVatRate,
} from "@/lib/money";
import { formatZonedIsoDate } from "@/lib/cron/timezone";
import { createLatestTaskGuard } from "@/lib/pdf/latest-task-guard";
import { useNotifications } from "@/components/notification-context";

function createEmptyPdfFields() {
  return {
    invoiceNumber: "",
    documentTypeId: "",
    contractorId: "",
    issueDate: formatZonedIsoDate(new Date()),
    dueDate: "",
    amountNet: "",
    vatRate: "",
    amountVat: "",
    amountGross: "",
  };
}

export function UploadPanel() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [pdfFields, setPdfFields] = useState(createEmptyPdfFields);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionGuardRef = useRef(createLatestTaskGuard());
  const uploadDoc = useUploadDocument();
  const { add: addNotification } = useNotifications();
  const extractPdf = useExtractPdfDocument();
  const { data: docTypes } = useDocumentTypes();
  const { data: contractors } = useContractors();
  const { data: uploadConfig } = useUploadConfig();
  const maxUploadSizeBytes =
    uploadConfig?.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_SIZE_BYTES;

  const docTypeItems = useMemo(
    () => Object.fromEntries(docTypes?.map((t: { id: string; name: string }) => [t.id, t.name]) ?? []),
    [docTypes],
  );

  const contractorItems = useMemo(
    () => Object.fromEntries(contractors?.map((c: { id: string; name: string }) => [c.id, c.name]) ?? []),
    [contractors],
  );

  const handleFileSelect = useCallback(async (f: File) => {
    const selectionVersion = selectionGuardRef.current.begin();
    const validationError = getUploadFileValidationError(f, maxUploadSizeBytes);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setFile(f);
    setPdfFields(createEmptyPdfFields());
    setExtractionWarnings([]);
    const selectedIsPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    setIsPdf(selectedIsPdf);

    if (!selectedIsPdf) return;

    try {
      const result = await extractPdf.mutateAsync(f);
      if (!selectionGuardRef.current.isCurrent(selectionVersion)) return;
      setPdfFields(() => {
        const next = { ...createEmptyPdfFields(), ...result.fields };
        if (result.fields.amountNet && result.fields.amountVat) {
          try {
            next.vatRate = inferVatRate(
              result.fields.amountNet,
              result.fields.amountVat,
            );
            next.amountVat = calculateVatAmount(next.amountNet, next.vatRate);
            next.amountGross = calculateGrossFromRate(next.amountNet, next.vatRate);
          } catch {
            next.vatRate = "";
          }
        }
        return next;
      });
      setExtractionWarnings(result.warnings);
      if (result.detected.length > 0) {
        toast.success(`Automatycznie uzupełniono ${result.detected.length} pól`);
      } else if (result.warnings.length > 0) {
        toast.warning("Nie udało się automatycznie uzupełnić danych. Sprawdź formularz.");
      }
    } catch (error) {
      if (!selectionGuardRef.current.isCurrent(selectionVersion)) return;
      toast.warning(
        error instanceof Error
          ? `Nie udało się odczytać PDF: ${error.message}`
          : "Nie udało się odczytać PDF. Uzupełnij dane ręcznie.",
      );
    }
  }, [extractPdf, maxUploadSizeBytes]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

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
      const validation = pdfUploadSchema.safeParse(pdfFields);
      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message ?? "Popraw dane dokumentu PDF");
        return;
      }

      for (const [key, value] of Object.entries(validation.data)) {
        if (typeof value === "string" && value) formData.append(key, value);
      }
    }

    try {
      await uploadDoc.mutateAsync(formData);
      toast.success("Dokument dodany do bufora");
      addNotification({ title: "Dokument dodany do bufora", description: file?.name ?? "" });
      resetAndClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd uploadu");
    }
  }

  function resetAndClose() {
    selectionGuardRef.current.invalidate();
    setFile(null);
    setIsPdf(false);
    setExtractionWarnings([]);
    setPdfFields(createEmptyPdfFields());
    setOpen(false);
  }

  function updatePdf(key: string, value: string) {
    setPdfFields((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "amountNet" || key === "vatRate") {
        if (next.amountNet && next.vatRate) {
          try {
            next.amountVat = calculateVatAmount(next.amountNet, next.vatRate);
            next.amountGross = calculateGrossFromRate(next.amountNet, next.vatRate);
          } catch {
            next.amountVat = "";
            next.amountGross = "";
          }
        } else {
          next.amountVat = "";
          next.amountGross = "";
        }
      }

      return next;
    });
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
          <div className="min-w-0 space-y-4">
            {!file ? (
              <button
                type="button"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                aria-label="Wybierz albo upuść plik PDF lub XML"
              >
                <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Przeciągnij plik lub kliknij
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF lub XML (max {uploadConfig?.maxSizeMb ?? 10} MB)
                </p>
              </button>
            ) : (
              <div className="flex w-full min-w-0 items-center gap-3 rounded-lg border p-3">
                <FileUp className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {file.type.includes("pdf") ? "PDF" : "XML"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    selectionGuardRef.current.invalidate();
                    setFile(null);
                    setIsPdf(false);
                    setExtractionWarnings([]);
                    setPdfFields(createEmptyPdfFields());
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Zmień
                </Button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xml,application/pdf,text/xml,application/xml"
              className="sr-only"
              aria-label="Plik dokumentu PDF lub XML"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (selectedFile) void handleFileSelect(selectedFile);
              }}
            />

            {file && isPdf && extractPdf.isPending && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Odczytywanie danych z dokumentu…
              </div>
            )}

            {file && isPdf && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Plik PDF: sprawdź automatycznie uzupełnione dane
                </p>
                {extractionWarnings.length > 0 && (
                  <div
                    className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    role="status"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      {extractionWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="upload-invoice-number">
                    Numer faktury <span className="text-destructive" aria-hidden="true">*</span>
                    <span className="sr-only">(pole wymagane)</span>
                  </Label>
                  <Input
                    id="upload-invoice-number"
                    required
                    value={pdfFields.invoiceNumber}
                    onChange={(e) => updatePdf("invoiceNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="upload-document-type">
                    Typ dokumentu <span className="text-destructive" aria-hidden="true">*</span>
                    <span className="sr-only">(pole wymagane)</span>
                  </Label>
                  <Select
                    value={pdfFields.documentTypeId || null}
                    onValueChange={(v) => updatePdf("documentTypeId", v ?? "")}
                    items={docTypeItems}
                  >
                    <SelectTrigger id="upload-document-type" aria-required="true">
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
                  <Label htmlFor="upload-contractor">
                    Kontrahent <span className="text-destructive" aria-hidden="true">*</span>
                    <span className="sr-only">(pole wymagane)</span>
                  </Label>
                  <Select
                    value={pdfFields.contractorId || null}
                    onValueChange={(v) => updatePdf("contractorId", v ?? "")}
                    items={contractorItems}
                  >
                    <SelectTrigger id="upload-contractor" aria-required="true">
                      <SelectValue placeholder="Wybierz kontrahenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors?.map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="upload-issue-date">
                      Data wystawienia <span className="text-destructive" aria-hidden="true">*</span>
                      <span className="sr-only">(pole wymagane)</span>
                    </Label>
                    <DateInput
                      id="upload-issue-date"
                      required
                      value={pdfFields.issueDate}
                      onChange={(v) => updatePdf("issueDate", v)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="upload-due-date">
                      Termin płatności <span className="text-destructive" aria-hidden="true">*</span>
                      <span className="sr-only">(pole wymagane)</span>
                    </Label>
                    <DateInput
                      id="upload-due-date"
                      required
                      value={pdfFields.dueDate}
                      onChange={(v) => updatePdf("dueDate", v)}
                      min={pdfFields.issueDate || undefined}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="upload-amount-net">
                      Netto <span className="text-destructive" aria-hidden="true">*</span>
                      <span className="sr-only">(pole wymagane)</span>
                    </Label>
                    <Input
                      id="upload-amount-net"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      required
                      value={pdfFields.amountNet}
                      onChange={(e) => updatePdf("amountNet", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="upload-vat-rate">
                      VAT (%) <span className="text-destructive" aria-hidden="true">*</span>
                      <span className="sr-only">(pole wymagane)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="upload-vat-rate"
                        type="text"
                        inputMode="decimal"
                        placeholder="23"
                        required
                        className="pr-8 tabular-nums"
                        value={pdfFields.vatRate}
                        onChange={(e) => updatePdf("vatRate", e.target.value)}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="upload-amount-gross">
                      Brutto <span className="text-destructive" aria-hidden="true">*</span>
                      <span className="sr-only">(pole wymagane, wyliczane automatycznie)</span>
                    </Label>
                    <Input
                      id="upload-amount-gross"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      required
                      readOnly
                      aria-readonly="true"
                      className="bg-muted/50 font-medium tabular-nums"
                      value={pdfFields.amountGross}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kwota VAT i Brutto są wyliczane automatycznie na podstawie Netto i stawki VAT.
                </p>
              </div>
            )}

            {file && !isPdf && (
              <p className="text-sm text-muted-foreground">
                Plik XML zostanie automatycznie sparsowany. Dane faktury zostaną
                wypełnione na podstawie zawartości pliku.
              </p>
            )}

            <div className="flex w-full flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={resetAndClose} className="w-full sm:w-auto">
                Anuluj
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploadDoc.isPending || extractPdf.isPending}
                className="w-full sm:w-auto"
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
