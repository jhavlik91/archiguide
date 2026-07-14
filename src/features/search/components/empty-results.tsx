import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toSearchParams } from "../params";
import { buildEmptySuggestions, type RelatedProfession } from "../suggestions";
import type { SearchState } from "../types";

/**
 * Prázdný výsledek s konkrétními dalšími kroky (T034 § Main flow #6). Nikdy jen
 * „nic nenalezeno" — nabídne odebrání filtru, rozšíření regionu, příbuznou
 * profesi nebo zobrazení celého katalogu. Návrhy jsou odkazy (URL-persistované),
 * takže fungují i bez JS a jdou sdílet.
 */
export function EmptyResults({
  state,
  related,
}: {
  state: SearchState;
  related: RelatedProfession[];
}) {
  const suggestions = buildEmptySuggestions(state, related);

  return (
    <EmptyState
      icon={<SearchX aria-hidden />}
      title="Žádní profesionálové neodpovídají zadání"
      description="Zkuste hledání rozvolnit — některé z těchto kroků obvykle pomůže:"
      action={
        suggestions.length > 0 ? (
          <ul className="flex flex-col items-center gap-2">
            {suggestions.map((s, i) => (
              <li key={i}>
                <Link
                  href={
                    hrefFor(state, s)
                      ? `/profesionalove?${hrefFor(state, s)}`
                      : "/profesionalove"
                  }
                  className="text-primary text-sm font-medium hover:underline"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : undefined
      }
    />
  );
}

/** Sestaví URL query pro daný návrh z aktuálního stavu (kurzor se vždy resetuje). */
function hrefFor(
  state: SearchState,
  suggestion: ReturnType<typeof buildEmptySuggestions>[number],
): string {
  const base: Partial<SearchState> = { ...state, cursor: null };

  switch (suggestion.kind) {
    case "remove_filter": {
      const map = {
        region: "region",
        specialization: "specialization",
        verified: "verifiedOnly",
        profession: "profession",
      } as const;
      const key = map[suggestion.filter];
      return toSearchParams(
        { ...base, [key]: key === "verifiedOnly" ? false : null },
        { resetCursor: true },
      ).toString();
    }
    case "related_profession":
      // Nahradí dotaz filtrem profese — širší, spolehlivější záběr.
      return toSearchParams(
        { ...base, query: "", profession: suggestion.slug },
        { resetCursor: true },
      ).toString();
    case "browse_all":
      return "";
  }
}
