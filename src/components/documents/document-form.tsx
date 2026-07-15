"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
import { addMoney } from "@/lib/money";

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryNode[];
}

function flattenCategories(cats: CategoryNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const cat of cats) {
    result.push({ id: cat.id, name: cat.name, depth });
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return result;
}

type FormValues = z.input<typeof documentFormSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editDocument?: DocumentRow | null;
}

export function DocumentFormSheet({ open, onClose, editDocument }: Props) {
  const { data: docTypes } = useDocumentTypes();
  const { data: contractors } = useContractors();
  const { data: categories } = useCategories();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();

  const flatCats = categories ? flattenCategories(categories) : [];

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

  const [amountNet, amountVat, documentTypeId, contractorId, categoryId] =
    useWatch({
      control,
      name: [
        "amountNet",
        "amountVat",
        "documentTypeId",
        "contractorId",
        "categoryId",
      ],
    });

  useEffect(() => {
    if (amountNet && amountVat) {
      try {
        setValue("amountGross", addMoney(amountNet, amountVat), {
          shouldValidate: true,
        });
      } catch {
        // Resolver pokaże błąd przy polu źródłowym.
      }
    }
  }, [amountNet, amountVat, setValue]);

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
        issueDate: new Date().toISOString().split("T")[0],
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
      } else {
        await createDoc.mutateAsync({
          ...values,
          source: "MANUAL",
          status: "ACCEPTED",
        });
        toast.success("Dokument dodany do rejestru");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wystąpił błąd");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[500px] overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editDocument ? "Edytuj dokument" : "Dodaj dokument"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 px-4">
          <div className="space-y-1">
            <Label>Numer faktury</Label>
            <Input {...register("invoiceNumber")} />
            {errors.invoiceNumber && (
              <p className="text-xs text-destructive">{errors.invoiceNumber.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Typ dokumentu</Label>
            <Select
              value={documentTypeId || null}
              onValueChange={(v) => setValue("documentTypeId", v ?? "", { shouldValidate: true })}
              items={Object.fromEntries(docTypes?.map((t: { id: string; name: string }) => [t.id, t.name]) ?? [])}
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
            {errors.documentTypeId && (
              <p className="text-xs text-destructive">{errors.documentTypeId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Kontrahent</Label>
            <Select
              value={contractorId || null}
              onValueChange={(v) => setValue("contractorId", v ?? "", { shouldValidate: true })}
              items={Object.fromEntries(contractors?.map((c: { id: string; name: string }) => [c.id, c.name]) ?? [])}
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
            {errors.contractorId && (
              <p className="text-xs text-destructive">{errors.contractorId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data wystawienia</Label>
              <Input type="date" {...register("issueDate")} />
              {errors.issueDate && (
                <p className="text-xs text-destructive">{errors.issueDate.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Termin płatności</Label>
              <Input type="date" {...register("dueDate")} />
              {errors.dueDate && (
                <p className="text-xs text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Netto</Label>
              <Input type="number" step="0.01" {...register("amountNet")} />
              {errors.amountNet && (
                <p className="text-xs text-destructive">{errors.amountNet.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>VAT</Label>
              <Input type="number" step="0.01" {...register("amountVat")} />
              {errors.amountVat && (
                <p className="text-xs text-destructive">{errors.amountVat.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Brutto</Label>
              <Input
                type="number"
                step="0.01"
                {...register("amountGross")}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Numer rachunku bankowego</Label>
            <Input {...register("bankAccountNumber")} placeholder="26 cyfr" />
          </div>

          <div className="space-y-1">
            <Label>Kategoria</Label>
            <Select
              value={categoryId || null}
              onValueChange={(v) => setValue("categoryId", v === "__none__" ? null : v, { shouldValidate: true })}
              items={{ __none__: "Brak kategorii", ...Object.fromEntries(flatCats.map((c) => [c.id, "  ".repeat(c.depth) + c.name])) }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Brak kategorii" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Brak kategorii</SelectItem>
                {flatCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {"  ".repeat(c.depth) + c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
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
