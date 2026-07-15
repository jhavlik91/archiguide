import Link from "next/link";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toListingParams } from "../listing-params";
import { hasActiveRequestFilters, type RequestListingState } from "../listing-types";
import { publicRequestListPath } from "../paths";
import { BUDGET_BAND_LABELS } from "../budget-band";
import { REQUEST_TYPE_LABELS } from "../types";

/**
 * Prázdný výpis (T026 § Main flow #3, Edge cases). Nikdy jen „nic
 * nenalezeno" — nabídne odebrání konkrétního filtru nebo celý katalog, ať se
 * profesionál nezasekne ve slepé uličce.
 */
export function RequestListEmpty({ state }: { state: RequestListingState }) {
  const hasFilters = hasActiveRequestFilters(state);

  return (
    <EmptyState
      icon={<Inbox aria-hidden />}
      title="Žádné poptávky neodpovídají zadání"
      description={
        hasFilters
          ? "Zkuste odebrat některý z filtrů — obvykle to pomůže."
          : "Zatím tu nejsou žádné aktivní veřejné poptávky."
      }
      action={
        hasFilters ? (
          <ul className="flex flex-col items-center gap-2">
            {state.profession && (
              <SuggestionLink state={state} clear="profession" label="Zrušit filtr profese" />
            )}
            {state.region && (
              <SuggestionLink state={state} clear="region" label="Zrušit filtr regionu" />
            )}
            {state.type && (
              <SuggestionLink
                state={state}
                clear="type"
                label={`Zrušit filtr typu (${REQUEST_TYPE_LABELS[state.type]})`}
              />
            )}
            {state.budgetBand && (
              <SuggestionLink
                state={state}
                clear="budgetBand"
                label={`Zrušit rozpočtové pásmo (${BUDGET_BAND_LABELS[state.budgetBand]})`}
              />
            )}
            <li>
              <Link
                href={publicRequestListPath()}
                className="text-primary text-sm font-medium hover:underline"
              >
                Zobrazit všechny poptávky
              </Link>
            </li>
          </ul>
        ) : undefined
      }
    />
  );
}

function SuggestionLink({
  state,
  clear,
  label,
}: {
  state: RequestListingState;
  clear: keyof RequestListingState;
  label: string;
}) {
  const qs = toListingParams(
    { ...state, [clear]: null, cursor: null },
    { resetCursor: true },
  ).toString();
  const href = qs ? `${publicRequestListPath()}?${qs}` : publicRequestListPath();
  return (
    <li>
      <Link href={href} className="text-primary text-sm font-medium hover:underline">
        {label}
      </Link>
    </li>
  );
}
