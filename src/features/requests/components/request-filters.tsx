"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Filter, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { BUDGET_BAND_LABELS, BUDGET_BANDS, type BudgetBand } from "../budget-band";
import { toListingParams } from "../listing-params";
import type { RequestListingState } from "../listing-types";
import { publicRequestListPath } from "../paths";
import { REQUEST_TYPE_LABELS, REQUEST_TYPES, type RequestType } from "../types";
import type { RequestProfessionGroup } from "../listing-queries";

/** Radix Select nepovoluje prázdnou hodnotu položky — sentinel pro „vše". */
const ANY = "__any__";

/**
 * Filtry veřejného výpisu poptávek (T026 § Main flow #2). URL-persistované
 * (sdílitelný odfiltrovaný výpis) — odeslání přepíše query string. Na mobilu
 * schované v draweru (`Filter` tlačítko), na desktopu jako postranní panel
 * (stejný vzor jako `features/search/components/search-filters.tsx`, T034).
 */
export function RequestFilters({
  state,
  groups,
}: {
  state: RequestListingState;
  groups: RequestProfessionGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const [profession, setProfession] = React.useState(state.profession ?? ANY);
  const [region, setRegion] = React.useState(state.region ?? "");
  const [type, setType] = React.useState(state.type ?? ANY);
  const [budgetBand, setBudgetBand] = React.useState(state.budgetBand ?? ANY);

  React.useEffect(() => {
    setProfession(state.profession ?? ANY);
    setRegion(state.region ?? "");
    setType(state.type ?? ANY);
    setBudgetBand(state.budgetBand ?? ANY);
  }, [state]);

  function apply() {
    const qs = toListingParams(
      {
        profession: profession === ANY ? null : profession,
        region: region.trim() || null,
        type: type === ANY ? null : (type as RequestType),
        budgetBand: budgetBand === ANY ? null : (budgetBand as BudgetBand),
      },
      { resetCursor: true },
    ).toString();
    startTransition(() => {
      router.push(qs ? `${publicRequestListPath()}?${qs}` : publicRequestListPath());
      setOpen(false);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <span className="text-muted-foreground text-sm">Filtry poptávek</span>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Filter className="size-4" />
          Filtry
        </Button>
      </div>

      <div
        className={cn(
          "mt-4 space-y-4 rounded-lg border p-4 lg:mt-0 lg:block",
          open ? "block" : "hidden",
        )}
      >
        <div className="flex items-center justify-between lg:hidden">
          <span className="font-medium">Filtry</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-profese">Profese</Label>
          <Select value={profession} onValueChange={setProfession}>
            <SelectTrigger id="rf-profese">
              <SelectValue placeholder="Všechny profese" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Všechny profese</SelectItem>
              {groups.map((group) => (
                <React.Fragment key={group.slug}>
                  {group.professions.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-region">Region</Label>
          <Input
            id="rf-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Např. Praha, Morava…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-typ">Typ projektu</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="rf-typ">
              <SelectValue placeholder="Všechny typy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Všechny typy</SelectItem>
              {REQUEST_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-rozpocet">Rozpočtové pásmo</Label>
          <Select value={budgetBand} onValueChange={setBudgetBand}>
            <SelectTrigger id="rf-rozpocet">
              <SelectValue placeholder="Libovolný rozpočet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Libovolný rozpočet</SelectItem>
              {BUDGET_BANDS.map((band) => (
                <SelectItem key={band} value={band}>
                  {BUDGET_BAND_LABELS[band]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Orientační — dle rozpočtu uvedeného zadavatelem.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={apply}
        >
          Použít filtry
        </Button>
      </div>
    </>
  );
}
