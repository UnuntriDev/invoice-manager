"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCategories,
  useCategorizationRules,
  useCreateCategorizationRule,
  useUpdateCategorizationRule,
  useDeleteCategorizationRule,
} from "@/lib/hooks/use-documents";
import { categorizationRuleCreateSchema } from "@/lib/validators/schemas";
import { flattenCategories } from "@/lib/categories";
import {
  ruleMatchFieldLabels,
  type RuleMatchField,
} from "@/lib/category-rules";
import { QueryErrorState } from "@/components/query-error-state";
import { useNotifications } from "@/components/notification-context";

interface Rule {
  id: string;
  pattern: string;
  matchField: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
  category: { id: string; name: string };
}

function CategorizationRulesPageContent() {
  const searchParams = useSearchParams();
  const pageRouter = useRouter();
  const {
    data: rules,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCategorizationRules();
  const { data: categories } = useCategories();
  const createRule = useCreateCategorizationRule();
  const updateRule = useUpdateCategorizationRule();
  const deleteRule = useDeleteCategorizationRule();
  const { add: addNotification } = useNotifications();

  const actionAdd = searchParams.get("action") === "add";
  const [formOpen, setFormOpen] = useState(actionAdd);

  useEffect(() => {
    if (actionAdd) pageRouter.replace("/settings/categorization-rules");
  }, [actionAdd, pageRouter]);

  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [pattern, setPattern] = useState("");
  const [matchField, setMatchField] = useState<RuleMatchField>("contractorName");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);

  const flatCats = useMemo(
    () => (categories ? flattenCategories(categories, { prefix: "— " }) : []),
    [categories],
  );
  const categoryItems = useMemo(
    () => Object.fromEntries(flatCats.map((c) => [c.id, c.label])),
    [flatCats],
  );
  const matchFieldItems = useMemo(
    () => ({ ...ruleMatchFieldLabels }),
    [],
  );

  function openNew() {
    setEditRule(null);
    setPattern("");
    setMatchField("contractorName");
    setCategoryId(null);
    setPriority("0");
    setFormOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditRule(rule);
    setPattern(rule.pattern);
    setMatchField(rule.matchField as RuleMatchField);
    setCategoryId(rule.categoryId);
    setPriority(String(rule.priority));
    setFormOpen(true);
  }

  async function handleSave() {
    const validation = categorizationRuleCreateSchema.safeParse({
      pattern,
      matchField,
      categoryId,
      priority: Number(priority) || 0,
      isActive: editRule?.isActive ?? true,
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Popraw dane reguły");
      return;
    }
    try {
      if (editRule) {
        await updateRule.mutateAsync({ id: editRule.id, data: validation.data });
        toast.success("Reguła zaktualizowana");
        addNotification({ title: "Reguła kategoryzacji zaktualizowana", description: validation.data.pattern });
      } else {
        await createRule.mutateAsync(validation.data);
        toast.success("Reguła dodana");
        addNotification({ title: "Reguła kategoryzacji dodana", description: validation.data.pattern });
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zapisu");
    }
  }

  async function handleToggleActive(rule: Rule) {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        data: { isActive: !rule.isActive },
      });
      toast.success(rule.isActive ? "Reguła wyłączona" : "Reguła włączona");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd zapisu");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      toast.success("Reguła usunięta");
      addNotification({ title: "Reguła kategoryzacji usunięta", description: deleteTarget.pattern });
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Błąd usuwania");
    }
  }

  const ruleList: Rule[] = rules || [];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h1 className="text-2xl leading-tight font-bold">Reguły kategoryzacji</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Auto-kategoryzacja dokumentów po słowach kluczowych
          </p>
        </div>
        <Button className="h-10 px-4 text-sm transition-shadow duration-300 hover:shadow-[0_0_20px_2px_#009d6666]" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj regułę
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Reguły działają dla dokumentów, których kontrahent nie ma domyślnej
        kategorii. Wyższy priorytet wygrywa; przy równym — dłuższe (bardziej
        specyficzne) słowo kluczowe.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState
          title="Nie udało się pobrać reguł kategoryzacji"
          error={error}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : !ruleList.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Wand2 className="mb-4 h-16 w-16" />
          <h3 className="text-lg font-medium">Brak reguł kategoryzacji</h3>
          <p className="text-sm">
            Dodaj pierwszą regułę, np. „paliwo&quot; → Transport
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Słowo kluczowe</TableHead>
                <TableHead>Pole dopasowania</TableHead>
                <TableHead>Kategoria</TableHead>
                <TableHead>Priorytet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruleList.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.pattern}</TableCell>
                  <TableCell className="text-sm">
                    {ruleMatchFieldLabels[rule.matchField as RuleMatchField] ??
                      rule.matchField}
                  </TableCell>
                  <TableCell className="text-sm">{rule.category.name}</TableCell>
                  <TableCell className="text-sm tabular-nums">{rule.priority}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rule)}
                      title={rule.isActive ? "Kliknij, aby wyłączyć" : "Kliknij, aby włączyć"}
                      aria-label={`${rule.isActive ? "Wyłącz" : "Włącz"} regułę ${rule.pattern}`}
                    >
                      <Badge variant={rule.isActive ? "outline" : "secondary"}>
                        {rule.isActive ? "Aktywna" : "Wyłączona"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(rule)}
                        title="Edytuj"
                        aria-label={`Edytuj regułę ${rule.pattern}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => setDeleteTarget(rule)}
                        title="Usuń"
                        aria-label={`Usuń regułę ${rule.pattern}`}
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
              {editRule ? "Edytuj regułę" : "Nowa reguła kategoryzacji"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rule-pattern">Słowo kluczowe <span className="text-destructive">*</span></Label>
              <Input
                id="rule-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="np. paliwo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-match-field">Pole dopasowania <span className="text-destructive">*</span></Label>
              <Select
                value={matchField}
                onValueChange={(v) => setMatchField((v as RuleMatchField) ?? "contractorName")}
                items={matchFieldItems}
              >
                <SelectTrigger id="rule-match-field" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ruleMatchFieldLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-category">Kategoria docelowa <span className="text-destructive">*</span></Label>
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v)}
                items={categoryItems}
              >
                <SelectTrigger id="rule-category" className="w-full">
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {flatCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-priority">Priorytet</Label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Anuluj
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !pattern.trim() ||
                  !categoryId ||
                  createRule.isPending ||
                  updateRule.isPending
                }
              >
                {editRule ? "Zapisz zmiany" : "Dodaj"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć regułę?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć regułę &quot;{deleteTarget?.pattern}
              &quot;? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CategorizationRulesPage() {
  return (
    <Suspense fallback={null}>
      <CategorizationRulesPageContent />
    </Suspense>
  );
}
