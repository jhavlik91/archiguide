"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  createCategoryAction,
  createProfessionAction,
  deactivateProfessionAction,
  deleteCategoryAction,
  deleteProfessionAction,
  reactivateProfessionAction,
  updateCategoryAction,
  updateProfessionAction,
} from "../actions";

export type TaxonomyProfessionRow = {
  id: string;
  name: string;
  synonyms: string[];
  regulated: boolean;
  verificationHints: string[];
  status: "active" | "archived";
  position: number;
  usageCount: number;
};

export type TaxonomyCategoryRow = {
  id: string;
  name: string;
  position: number;
  professions: TaxonomyProfessionRow[];
};

type CategoryDialogState = { mode: "create" } | { mode: "edit"; category: TaxonomyCategoryRow };
type ProfessionDialogState =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; categoryId: string; profession: TaxonomyProfessionRow };

/** Formulářová data profese (parsuje se z volných textových polí do polí). */
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Admin CRUD taxonomie (T035 § Main flow 4): kategorie a profese. Profese se
 * deaktivují místo mazání, pokud je používá profil (server to stejně vynutí).
 * Duplicitní profese (podobný název/synonymum) je jen varování, které admin
 * může potvrdit a pokračovat.
 */
export function TaxonomyManager({
  categories,
}: {
  categories: TaxonomyCategoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState | null>(null);
  const [professionDialog, setProfessionDialog] = useState<ProfessionDialogState | null>(null);

  const [catName, setCatName] = useState("");
  const [catPosition, setCatPosition] = useState(0);

  const [profName, setProfName] = useState("");
  const [profCategoryId, setProfCategoryId] = useState("");
  const [profSynonyms, setProfSynonyms] = useState("");
  const [profRegulated, setProfRegulated] = useState(false);
  const [profHints, setProfHints] = useState("");
  const [profPosition, setProfPosition] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState<string[] | null>(null);

  function openCreateCategory() {
    setCatName("");
    setCatPosition(categories.length);
    setCategoryDialog({ mode: "create" });
  }

  function openEditCategory(category: TaxonomyCategoryRow) {
    setCatName(category.name);
    setCatPosition(category.position);
    setCategoryDialog({ mode: "edit", category });
  }

  function submitCategory() {
    if (!categoryDialog) return;
    const input = { name: catName.trim(), position: catPosition };
    if (input.name.length < 2) {
      toast.error("Zadejte název kategorie.");
      return;
    }
    startTransition(async () => {
      const result =
        categoryDialog.mode === "create"
          ? await createCategoryAction(input)
          : await updateCategoryAction(categoryDialog.category.id, input);
      if (result.ok) {
        toast.success("Kategorie uložena.");
        setCategoryDialog(null);
        router.refresh();
      } else if (result.error !== "duplicate_warning") {
        toast.error(result.message);
      }
    });
  }

  function deleteCategory(category: TaxonomyCategoryRow) {
    if (!confirm(`Opravdu smazat kategorii „${category.name}“?`)) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.ok) {
        toast.success("Kategorie smazána.");
        router.refresh();
      } else if (result.error !== "duplicate_warning") {
        toast.error(result.message);
      }
    });
  }

  function openCreateProfession(categoryId: string) {
    setProfName("");
    setProfCategoryId(categoryId);
    setProfSynonyms("");
    setProfRegulated(false);
    setProfHints("");
    setProfPosition(0);
    setDuplicateWarning(null);
    setProfessionDialog({ mode: "create", categoryId });
  }

  function openEditProfession(categoryId: string, profession: TaxonomyProfessionRow) {
    setProfName(profession.name);
    setProfCategoryId(categoryId);
    setProfSynonyms(profession.synonyms.join(", "));
    setProfRegulated(profession.regulated);
    setProfHints(profession.verificationHints.join(", "));
    setProfPosition(profession.position);
    setDuplicateWarning(null);
    setProfessionDialog({ mode: "edit", categoryId, profession });
  }

  function submitProfession(confirmDuplicate = false) {
    if (!professionDialog) return;
    const input = {
      name: profName.trim(),
      categoryId: profCategoryId,
      synonyms: parseList(profSynonyms),
      regulated: profRegulated,
      verificationHints: parseList(profHints),
      position: profPosition,
    };
    if (input.name.length < 2) {
      toast.error("Zadejte název profese.");
      return;
    }
    startTransition(async () => {
      const result =
        professionDialog.mode === "create"
          ? await createProfessionAction(input, confirmDuplicate)
          : await updateProfessionAction(
              professionDialog.profession.id,
              input,
              confirmDuplicate,
            );
      if (result.ok) {
        toast.success("Profese uložena.");
        setProfessionDialog(null);
        setDuplicateWarning(null);
        router.refresh();
      } else if (result.error === "duplicate_warning") {
        setDuplicateWarning(result.similar);
      } else {
        toast.error(result.message);
      }
    });
  }

  function toggleProfessionStatus(profession: TaxonomyProfessionRow) {
    startTransition(async () => {
      const action =
        profession.status === "active"
          ? deactivateProfessionAction
          : reactivateProfessionAction;
      const result = await action(profession.id);
      if (result.ok) {
        toast.success(
          profession.status === "active" ? "Profese deaktivována." : "Profese aktivována.",
        );
        router.refresh();
      } else if (result.error !== "duplicate_warning") {
        toast.error(result.message);
      }
    });
  }

  function deleteProfession(profession: TaxonomyProfessionRow) {
    if (!confirm(`Opravdu smazat profesi „${profession.name}“?`)) return;
    startTransition(async () => {
      const result = await deleteProfessionAction(profession.id);
      if (result.ok) {
        toast.success("Profese smazána.");
        router.refresh();
      } else if (result.error !== "duplicate_warning") {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Taxonomie</h1>
        <Button onClick={openCreateCategory}>
          <Plus className="size-4" /> Nová kategorie
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-base leading-none font-semibold tracking-tight">
                {category.name}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Upravit ${category.name}`}
                  onClick={() => openEditCategory(category)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Smazat ${category.name}`}
                  disabled={pending}
                  onClick={() => deleteCategory(category)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {category.professions.map((profession) => (
                <div
                  key={profession.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {profession.name}
                      {profession.regulated && (
                        <Badge variant="warning" className="ml-2">
                          Regulovaná
                        </Badge>
                      )}
                    </p>
                    {profession.synonyms.length > 0 && (
                      <p className="text-muted-foreground truncate text-xs">
                        Synonyma: {profession.synonyms.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={profession.status === "active" ? "success" : "secondary"}>
                      {profession.status === "active" ? "Aktivní" : "Archivovaná"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Upravit ${profession.name}`}
                      onClick={() => openEditProfession(category.id, profession)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        profession.status === "active"
                          ? `Deaktivovat ${profession.name}`
                          : `Aktivovat ${profession.name}`
                      }
                      disabled={pending}
                      onClick={() => toggleProfessionStatus(profession)}
                    >
                      {profession.status === "active" ? (
                        <Archive className="size-4" />
                      ) : (
                        <ArchiveRestore className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Smazat ${profession.name}`}
                      disabled={pending || profession.usageCount > 0}
                      title={
                        profession.usageCount > 0
                          ? `Používá ${profession.usageCount} profil(ů) — nejdřív deaktivujte.`
                          : undefined
                      }
                      onClick={() => deleteProfession(profession)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateProfession(category.id)}
              >
                <Plus className="size-4" /> Nová profese
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kategorie: vytvoření/editace */}
      <Dialog
        open={categoryDialog !== null}
        onOpenChange={(open) => !open && setCategoryDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {categoryDialog?.mode === "edit" ? "Upravit kategorii" : "Nová kategorie"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Název</Label>
              <Input
                id="cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-position">Pořadí</Label>
              <Input
                id="cat-position"
                type="number"
                value={catPosition}
                onChange={(e) => setCatPosition(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>
              Zrušit
            </Button>
            <Button onClick={submitCategory} disabled={pending}>
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profese: vytvoření/editace */}
      <Dialog
        open={professionDialog !== null}
        onOpenChange={(open) => !open && setProfessionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {professionDialog?.mode === "edit" ? "Upravit profesi" : "Nová profese"}
            </DialogTitle>
            {duplicateWarning && (
              <DialogDescription className="text-warning-foreground">
                Podobná profese už existuje: {duplicateWarning.join(", ")}. Opravdu
                pokračovat?
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Název</Label>
              <Input
                id="prof-name"
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-synonyms">Synonyma (oddělená čárkou)</Label>
              <Input
                id="prof-synonyms"
                value={profSynonyms}
                onChange={(e) => setProfSynonyms(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-hints">Nápovědy k ověření (oddělené čárkou)</Label>
              <Input
                id="prof-hints"
                value={profHints}
                onChange={(e) => setProfHints(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={profRegulated}
                onCheckedChange={(v) => setProfRegulated(v === true)}
              />
              Regulovaná profese
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="prof-position">Pořadí</Label>
              <Input
                id="prof-position"
                type="number"
                value={profPosition}
                onChange={(e) => setProfPosition(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfessionDialog(null)}>
              Zrušit
            </Button>
            {duplicateWarning ? (
              <Button onClick={() => submitProfession(true)} disabled={pending}>
                Přesto vytvořit
              </Button>
            ) : (
              <Button onClick={() => submitProfession(false)} disabled={pending}>
                Uložit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
