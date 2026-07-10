"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProfessionLink } from "../types";

export type ProfessionOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string; professions: ProfessionOption[] };

/**
 * Výběr profesí z taxonomie (T005) s označením hlavní profese. Řízená komponenta
 * — stav drží rodič (onboarding wizard i editor). Vícenásobné profese + jedna
 * hlavní (hvězda) odpovídá T007 (hlavní 1, vedlejší 0–n).
 */
export function ProfessionPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: ProfessionLink[];
  onChange: (next: ProfessionLink[]) => void;
}) {
  const selectedIds = new Set(value.map((l) => l.professionId));
  const nameById = new Map(
    categories.flatMap((c) => c.professions.map((p) => [p.id, p.name] as const)),
  );

  function toggle(professionId: string, checked: boolean) {
    if (checked) {
      const next = [...value, { professionId, isPrimary: value.length === 0 }];
      onChange(next);
    } else {
      const next = value.filter((l) => l.professionId !== professionId);
      // Pokud jsme odebrali hlavní, povyš první zbývající.
      if (next.length > 0 && !next.some((l) => l.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      onChange(next);
    }
  }

  function setPrimary(professionId: string) {
    onChange(
      value.map((l) => ({ ...l, isPrimary: l.professionId === professionId })),
    );
  }

  return (
    <div className="space-y-6">
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Vybrané profese</p>
          <p className="text-muted-foreground text-xs">
            Hvězdou označte hlavní profesi.
          </p>
          <ul className="flex flex-wrap gap-2">
            {value.map((link) => (
              <li key={link.professionId}>
                <button
                  type="button"
                  onClick={() => setPrimary(link.professionId)}
                  aria-pressed={link.isPrimary}
                  aria-label={
                    link.isPrimary
                      ? `${nameById.get(link.professionId)} — hlavní profese`
                      : `Nastavit ${nameById.get(link.professionId)} jako hlavní`
                  }
                  className={cn(
                    "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2",
                    link.isPrimary
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      link.isPrimary && "fill-primary text-primary",
                    )}
                  />
                  {nameById.get(link.professionId) ?? link.professionId}
                  {link.isPrimary && (
                    <Badge variant="secondary" className="ml-1">
                      hlavní
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((category) => (
          <fieldset key={category.id} className="space-y-2">
            <legend className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {category.name}
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {category.professions.map((profession) => {
                const id = `prof-${profession.id}`;
                return (
                  <div key={profession.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={selectedIds.has(profession.id)}
                      onCheckedChange={(c) =>
                        toggle(profession.id, c === true)
                      }
                    />
                    <Label htmlFor={id} className="font-normal">
                      {profession.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
