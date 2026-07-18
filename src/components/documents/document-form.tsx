"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/components/notification-context";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useDocumentTypes,
  useContractors,
  useCategories,
  useCreateDocument,
  useUpdateDocument,
} from "@/lib/hooks/use-documents";
import { toast } from "sonner";
import type { DocumentRow } from "./document-columns";
import { documentFormSchema, type DocumentUpdate } from "@/lib/validators/schemas";
import type { z } from "zod";
import {
  calculateGrossFromRate,
  calculateVatAmount,
  inferVatRate,
  parsePercentage,
} from "@/lib/money";
import { flattenCategories } from "@/lib/categories";
import { formatZonedIsoDate } from "@/lib/cron/timezone";

type FormValues = z.input<typeof documentFormSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editDocument?: DocumentRow | null;
}

function getInitialVatRate(editDocument?: DocumentRow | null) {
  if (!editDocument) return { value: "23", error: null as string | null };
  try {
    return {
      value: inferVatRate(
        String(editDocument.amountNet),
        String(editDocument.amountVat),
      ),
      error: null as string | null,
    };
  } catch {
    return {
      value: "",
      error: "Nie można wyznaczyć stawki VAT z zapisanych kwot",
    };
  }
}

export function DocumentFormSheet({ open, onClose, editDocument }: Props) {
  const initialVatRate = getInitialVatRate(editDocument);
  const [vatRate, setVatRate] = useState(initialVatRate.value);
  const [vatRateError, setVatRateError] = useState<string | null>(
    initialVatRate.error,
  );
  const { data: docTypes } = useDocumentTypes();
  const { data: contractors } = useContractors();
  const { data: categories } = useCategories();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const { add: addNotification } = useNotifications();

  const flatCats = useMemo(
    () => (categories ? flattenCategories(categories) : []),
    [categories],
  );

  const docTypeItems = useMemo(
    () => Object.fromEntries(docTypes?.map((t: { id: string; name: string }) => [t.id, t.name]) ?? []),
    [docTypes],
  );

  const contractorItems = useMemo(
    () => Object.fromEntries(contractors?.map((c: { id: string; name: string }) => [c.id, c.name]) ?? []),
    [contractors],
  );

  const categoryItems = useMemo(
    () => ({ __none__: "Brak kategorii", ...Object.fromEntries(flatCats.map((c) => [c.id, c.label])) }),
    [flatCats],
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, DocumentUpdate>({
    resolver: zodResolver(documentFormSchema),
  });

  const [amountNet, documentTypeId, contractorId, categoryId, issueDate, dueDate] =
    useWatch({
      control,
      name: [
        "amountNet",
        "documentTypeId",
        "contractorId",
        "categoryId",
        "issueDate",
        "dueDate",
      ],
    });

  function recalculateAmounts(netValue: string, rateValue: string) {
    try {
      parsePercentage(rateValue);
      setValue("amountVat", calculateVatAmount(netValue, rateValue), {
        shouldValidate: true,
      });
      setValue("amountGross", calculateGrossFromRate(netValue, rateValue), {
        shouldValidate: true,
      });
      setVatRateError(null);
    } catch (error) {
      setValue("amountVat", "", { shouldValidate: true });
      setValue("amountGross", "", { shouldValidate: true });
      setVatRateError(
        error instanceof Error ? error.message : "Nieprawidłowa stawka VAT",
      );
    }
  }

  useEffect(() => {
    if (editDocument) {
      const raw = editDocument as unknown as Record<string, unknown>;
      reset({
        invoiceNumber: editDocument.invoiceNumber,
        documentTypeId: (raw.documentTypeId as string) || "",
        contractorId: (raw.contractorId as string) || "",
        issueDate: editDocument.issueDate?.split("T")[0] || "",
        dueDate: editDocument.dueDate?.split("T")[0] || "",
        amountNet: String(editDocument.amountNet),
        amountVat: String(editDocument.amountVat),
        amountGross: String(editDocument.amountGross),
        bankAccountNumber: editDocument.bankAccountNumber || "",
        categoryId: (raw.categoryId as string) || null,
      });
    } else {
      reset({
        invoiceNumber: "",
        documentTypeId: "",
        contractorId: "",
        issueDate: formatZonedIsoDate(new Date()),
        dueDate: "",
        amountNet: "0.00",
        amountVat: "0.00",
        amountGross: "0.00",
        bankAccountNumber: "",
        categoryId: null,
      });
    }
  }, [editDocument, reset]);

  async function onSubmit(values: DocumentUpdate) {
    try {
      if (editDocument) {
        await updateDoc.mutateAsync({ id: editDocument.id, data: values });
        toast.success("Dokument zaktualizowany");
        addNotification({ title: "Dokument zaktualizowany", description: values.invoiceNumber ?? "" });
      } else {
        await createDoc.mutateAsync(values);
        toast.success("Dokument dodany do rejestru");
        addNotification({ title: "Dokument dodany do rejestru", description: values.invoiceNumber ?? "" });
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystąpił błąd");
    }
  }

  function handleClose() {
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-[500px] gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4 pr-14">
          <SheetTitle className="whitespace-nowrap text-lg font-semibold tracking-tight">
            {editDocument ? "Edytuj dokument" : "Dodaj dokument"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-5 py-4">
          <div className="space-y-1">
            <Label htmlFor="document-invoice-number">Numer faktury <span className="text-destructive">*</span></Label>
            <Input
              id="document-invoice-number"
              aria-invalid={Boolean(errors.invoiceNumber)}
              aria-describedby={errors.invoiceNumber ? "document-invoice-number-error" : undefined}
              {...register("invoiceNumber")}
            />
            {errors.invoiceNumber && (
              <p id="document-invoice-number-error" className="text-xs text-destructive">{errors.invoiceNumber.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="document-type">Typ dokumentu <span className="text-destructive">*</span></Label>
            <Select
              value={documentTypeId || null}
              onValueChange={(v) => setValue("documentTypeId", v ?? "", { shouldValidate: true })}
              items={docTypeItems}
            >
              <SelectTrigger id="document-type" className="w-full" aria-invalid={Boolean(errors.documentTypeId)}>
                <SelectValue placeholder="Wybierz typ" />
              </SelectTrigger>
              <SelectContent className="w-max min-w-(--anchor-width)">
                {docTypes?.map((t: { id: string; name: string }) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.documentTypeId && (
              <p className="text-xs text-destructive">{errors.documentTypeId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="document-contractor">Kontrahent <span className="text-destructive">*</span></Label>
            <Select
              value={contractorId || null}
              onValueChange={(v) => setValue("contractorId", v ?? "", { shouldValidate: true })}
              items={contractorItems}
            >
              <SelectTrigger id="document-contractor" className="w-full" aria-invalid={Boolean(errors.contractorId)}>
                <SelectValue placeholder="Wybierz kontrahenta" />
              </SelectTrigger>
              <SelectContent>
                {contractors?.map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contractorId && (
              <p className="text-xs text-destructive">{errors.contractorId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="document-issue-date">Data wystawienia <span className="text-destructive">*</span></Label>
              <DateInput
                id="document-issue-date"
                value={issueDate || ""}
                onChange={(v) => setValue("issueDate", v, { shouldValidate: true })}
              />
              {errors.issueDate && (
                <p className="text-xs text-destructive">{errors.issueDate.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="document-due-date">Termin płatności <span className="text-destructive">*</span></Label>
              <DateInput
                id="document-due-date"
                value={dueDate || ""}
                onChange={(v) => setValue("dueDate", v, { shouldValidate: true })}
              />
              {errors.dueDate && (
                <p className="text-xs text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="document-amount-net">Netto <span className="text-destructive">*</span></Label>
              <Input
                id="document-amount-net"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...register("amountNet", {
                  onChange: (event) =>
                    recalculateAmounts(
                      event.target.value,
                      vatRate,
                    ),
                })}
              />
              {errors.amountNet && (
                <p className="text-xs text-destructive">{errors.amountNet.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="document-vat-rate">
                VAT (%) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="document-vat-rate"
                  type="text"
                  inputMode="decimal"
                  placeholder="23"
                  required
                  className="pr-8 tabular-nums"
                  value={vatRate}
                  onChange={(event) => {
                    setVatRate(event.target.value);
                    recalculateAmounts(amountNet || "", event.target.value);
                  }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  %
                </span>
              </div>
              {vatRateError && (
                <p className="text-xs text-destructive">{vatRateError}</p>
              )}
              <input type="hidden" {...register("amountVat")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="document-amount-gross">Brutto <span className="text-destructive">*</span></Label>
              <Input
                id="document-amount-gross"
                type="text"
                {...register("amountGross")}
                readOnly
                className="bg-muted font-medium tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kwota VAT i Brutto są wyliczane automatycznie na podstawie Netto i stawki VAT.
          </p>

          <div className="space-y-1">
            <Label htmlFor="document-bank-account">Numer rachunku bankowego</Label>
            <Input
              id="document-bank-account"
              {...register("bankAccountNumber")}
              placeholder="00 0000 0000 0000 0000 0000 0000"
              maxLength={32}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 26);
                let fmt = digits.slice(0, 2);
                for (let i = 2; i < digits.length; i += 4) {
                  fmt += " " + digits.slice(i, i + 4);
                }
                setValue("bankAccountNumber", fmt);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="document-category">Kategoria</Label>
            <Select
              value={categoryId || null}
              onValueChange={(v) => setValue("categoryId", v === "__none__" ? null : v, { shouldValidate: true })}
              items={categoryItems}
            >
              <SelectTrigger id="document-category" className="w-full">
                <SelectValue placeholder="Brak kategorii" />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={8}
                collisionAvoidance={{
                  side: "none",
                  align: "shift",
                  fallbackAxisSide: "none",
                }}
                className="max-h-[min(18rem,var(--available-height))] overscroll-contain"
              >
                <SelectItem value="__none__">Brak kategorii</SelectItem>
                {flatCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Anuluj
            </Button>
            <Button type="submit" disabled={createDoc.isPending || updateDoc.isPending}>
              {editDocument ? "Zapisz zmiany" : "Dodaj dokument"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
