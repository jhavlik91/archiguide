"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Star, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { RequestVisibility } from "@/features/requests/types";
import {
  dismissMatchAction,
  inviteMatchCandidateAction,
  restoreMatchAction,
  shortlistMatchAction,
  trackMatchProfileViewedAction,
  type MatchActionResult,
} from "../actions";
import type {
  EmptyMatchReason,
  MatchCandidateCard,
  MatchRecommendationView,
} from "../types";
import { RecommendationCard } from "./recommendation-card";

/**
 * Sekce „Doporučení profesionálové" na detailu poptávky (T029 § Main flow).
 * Tři záložky dle stavu doporučení (`shown`/`shortlisted`/`dismissed`) —
 * dismiss je vratný (`restoreMatchAction`), shortlist ne. Prázdný výsledek
 * enginu (žádný vhodný kandidát vůbec) je odlišen od prázdné jednotlivé
 * záložky (např. všichni uloženi do výběru) — obojí dostane poctivé
 * vysvětlení, nikdy jen tichou prázdnou stránku.
 */

const TABS = ["shown", "shortlisted", "dismissed"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  shown: "Doporučení",
  shortlisted: "Užší výběr",
  dismissed: "Skryté",
};

const TAB_EMPTY_TITLE: Record<Tab, string> = {
  shown: "Žádní noví kandidáti",
  shortlisted: "Zatím jste nikoho neuložili",
  dismissed: "Žádní skrytí kandidáti",
};

const TAB_EMPTY_DESCRIPTION: Record<Tab, string> = {
  shown:
    "Všichni doporučení kandidáti jsou už v užším výběru nebo skrytí — podívejte se do dalších záložek.",
  shortlisted:
    'Kandidáty do užšího výběru uložíte tlačítkem „Uložit do výběru" u karty v záložce Doporučení.',
  dismissed:
    "Skryté kandidáty najdete tady — kdykoli je můžete vrátit zpět mezi doporučení.",
};

const EMPTY_REASON_TEXT: Record<EmptyMatchReason, string> = {
  no_eligible_professionals:
    "Zatím nemáme profesionály s vybranou profesí ve vašem regionu. Zkuste zvážit širší region nebo doplňkovou profesi — jakmile se objeví vhodný kandidát, doporučení se tu objeví samo.",
};

export function RecommendationList({
  requestVisibility,
  recommendations: allRecommendations,
  candidates,
  emptyReason,
}: {
  requestVisibility: RequestVisibility;
  recommendations: MatchRecommendationView[];
  candidates: Record<string, MatchCandidateCard>;
  emptyReason: EmptyMatchReason | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Kandidát bez hydratované karty (výjimečně: profil publikovaný, ale zatím
  // bez slugu — `hydrateMatchCandidates` ho vynechá) nemá kartu, kterou by šlo
  // vykreslit. Vyfiltrováno JEDNOU tady, aby záložky, jejich počty i prázdný
  // stav pracovaly nad stejnou, konzistentní sadou — jinak by štítek záložky
  // ukazoval počet > 0 s prázdným obsahem místo poctivého empty state.
  const recommendations = allRecommendations.filter(
    (r) => candidates[r.candidateUserId] !== undefined,
  );

  function run(
    id: string,
    action: (recommendationId: string) => Promise<MatchActionResult>,
    successMessage: string,
  ) {
    setPendingId(id);
    startTransition(async () => {
      const res = await action(id);
      setPendingId(null);
      if (res.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (recommendations.length === 0) {
    if (!emptyReason) return null;
    return (
      <EmptyState
        icon={<Users aria-hidden />}
        title="Zatím žádní doporučení profesionálové"
        description={EMPTY_REASON_TEXT[emptyReason]}
      />
    );
  }

  return (
    <Tabs defaultValue="shown">
      <TabsList>
        {TABS.map((tab) => {
          const count = recommendations.filter((r) => r.status === tab).length;
          return (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]} ({count})
            </TabsTrigger>
          );
        })}
      </TabsList>

      {TABS.map((tab) => {
        const items = recommendations.filter((r) => r.status === tab);
        return (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {items.length === 0 ? (
              <EmptyState
                icon={
                  tab === "dismissed" ? (
                    <EyeOff aria-hidden />
                  ) : (
                    <Star aria-hidden />
                  )
                }
                title={TAB_EMPTY_TITLE[tab]}
                description={TAB_EMPTY_DESCRIPTION[tab]}
              />
            ) : (
              items.map((rec) => {
                const candidate = candidates[rec.candidateUserId];
                if (!candidate) return null;
                return (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    candidate={candidate}
                    requestVisibility={requestVisibility}
                    pending={pending && pendingId === rec.id}
                    onShortlist={() =>
                      run(
                        rec.id,
                        shortlistMatchAction,
                        "Uloženo do užšího výběru.",
                      )
                    }
                    onDismiss={() =>
                      run(rec.id, dismissMatchAction, "Kandidát skryt.")
                    }
                    onRestore={() =>
                      run(rec.id, restoreMatchAction, "Kandidát obnoven.")
                    }
                    onInvite={() =>
                      run(
                        rec.id,
                        inviteMatchCandidateAction,
                        "Kandidát osloven.",
                      )
                    }
                    onProfileClick={() =>
                      void trackMatchProfileViewedAction(rec.id).catch(() => {})
                    }
                  />
                );
              })
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
