"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toSearchParams } from "../params";
import {
  SORT_LABELS,
  SORT_OPTIONS,
  type SearchState,
  type SortOption,
} from "../types";

/** Skupina profesí (kategorie) pro select filtru. */
export type ProfessionGroup = {
  slug: string;
  name: string;
  professions: { slug: string; name: string }[];
};

/** Radix Select nepovoluje prázdnou hodnotu položky — sentinel pro „vše". */
const ANY = "__any__";

/**
 * Filtry vyhledávání profesionálů (T034 § Main flow #2). URL-persistované:
 * odeslání přepíše query string (sdílitelné, SEO). Na mobilu jsou filtry
 * schované v draweru (`Filter` tlačítko), na desktopu jako postranní panel.
 */
export function SearchFilters({
  state,
  groups,
}: {
  state: SearchState;
  groups: ProfessionGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  // Lokální stav formuláře, seedovaný z URL; „Hledat" ho propíše do URL.
  const [query, setQuery] = React.useState(state.query);
  const [profession, setProfession] = React.useState(state.profession ?? ANY);
  const [region, setRegion] = React.useState(state.region ?? "");
  const [specialization, setSpecialization] = React.useState(
    state.specialization ?? "",
  );
  const [verifiedOnly, setVerifiedOnly] = React.useState(state.verifiedOnly);

  // Když se změní URL zvenčí (např. návrh z prázdného výsledku), sesynchronizuj.
  React.useEffect(() => {
    setQuery(state.query);
    setProfession(state.profession ?? ANY);
    setRegion(state.region ?? "");
    setSpecialization(state.specialization ?? "");
    setVerifiedOnly(state.verifiedOnly);
  }, [state]);

  function navigate(next: Partial<SearchState>) {
    const qs = toSearchParams(
      {
        query,
        profession: profession === ANY ? null : profession,
        region: region.trim() || null,
        specialization: specialization.trim() || null,
        verifiedOnly,
        sort: state.sort,
        ...next,
      },
      { resetCursor: true },
    ).toString();
    startTransition(() => {
      router.push(qs ? `/profesionalove?${qs}` : "/profesionalove");
      setOpen(false);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({});
  }

  function changeSort(value: SortOption) {
    navigate({ sort: value });
  }

  return (
    <>
      {/* Řádek s dotazem (vždy viditelný) + spouštěč draweru na mobilu. */}
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Profese, jméno, specializace…"
            aria-label="Hledat profesionály"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>
          Hledat
        </Button>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Filter className="size-4" />
          Filtry
        </Button>
      </form>

      {/* Panel filtrů: postranní na desktopu, drawer (rozbalený) na mobilu. */}
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
          <Label htmlFor="f-profese">Profese</Label>
          <Select value={profession} onValueChange={setProfession}>
            <SelectTrigger id="f-profese">
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
          <Label htmlFor="f-region">Region / lokalita</Label>
          <Input
            id="f-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Např. Praha, Morava…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="f-spec">Specializace</Label>
          <Input
            id="f-spec"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="Např. dřevostavby…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={verifiedOnly}
            onCheckedChange={(v) => setVerifiedOnly(v === true)}
          />
          Jen ověřené účty
        </label>

        <Button
          type="button"
          className="w-full"
          disabled={pending}
          onClick={() => navigate({})}
        >
          Použít filtry
        </Button>
      </div>

      {/* Řazení (mimo panel, u výsledků). */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Label htmlFor="f-sort" className="text-muted-foreground text-sm">
          Řadit
        </Label>
        <Select
          value={state.sort}
          onValueChange={(v) => changeSort(v as SortOption)}
        >
          <SelectTrigger id="f-sort" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {SORT_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
