"use client";

import Link from "next/link";
import { Images, MapPin, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationBadges } from "@/features/verification/components/verification-badges";
import type { RequestVisibility } from "@/features/requests/types";
import { formatReasons } from "../reasons";
import type { MatchCandidateCard, MatchRecommendationView } from "../types";

/**
 * Jedna kandidátní karta doporučení (T029 § Main flow bod 1–3). Čistě
 * prezentační — akce (shortlist/dismiss/restore/invite) volá rodič, karta jen
 * vyvolá callback. Stejný tvar jako `ProfessionalCard` (T034), navíc lidsky
 * čitelný důvod doporučení a stav-závislé akce.
 */
export function RecommendationCard({
  recommendation,
  candidate,
  requestVisibility,
  pending = false,
  onShortlist,
  onDismiss,
  onRestore,
  onInvite,
  onProfileClick,
}: {
  recommendation: MatchRecommendationView;
  candidate: MatchCandidateCard;
  requestVisibility: RequestVisibility;
  pending?: boolean;
  onShortlist?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  onInvite?: () => void;
  onProfileClick?: () => void;
}) {
  const primary =
    candidate.professions.find((p) => p.isPrimary) ?? candidate.professions[0];
  const others = candidate.professions.filter((p) => p !== primary);
  const place = candidate.location ?? candidate.region;
  const reasonText = formatReasons(recommendation.reasons);
  const isDismissed = recommendation.status === "dismissed";
  const isShortlisted = recommendation.status === "shortlisted";

  return (
    <Card className={isDismissed ? "opacity-70" : undefined}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:p-6">
        {candidate.portfolioCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- náhled portfolia (chráněná URL), Image optim. řeší T016
          <img
            src={candidate.portfolioCoverUrl}
            alt=""
            className="bg-muted h-32 w-full shrink-0 rounded-md object-cover sm:w-44"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex h-32 w-full shrink-0 items-center justify-center rounded-md sm:w-44">
            <Images className="size-8" aria-hidden />
          </div>
        )}

        <CardContent className="flex-1 space-y-2 p-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="leading-snug font-semibold">{candidate.headline}</h3>
            {recommendation.sponsored ? (
              <Badge variant="secondary" className="gap-1">
                <Megaphone className="size-3.5" aria-hidden />
                Sponzorováno
              </Badge>
            ) : null}
            {isShortlisted ? (
              <Badge variant="success">V užším výběru</Badge>
            ) : null}
          </div>

          {primary ? (
            <p className="text-muted-foreground text-sm">
              {primary.name}
              {others.length > 0 ? (
                <span className="text-muted-foreground/70">
                  {" "}
                  + {others.length} další
                </span>
              ) : null}
            </p>
          ) : null}

          {place ? (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place}
            </p>
          ) : null}

          {reasonText ? <p className="text-sm">{reasonText}</p> : null}

          <VerificationBadges types={candidate.badges} className="pt-1" />

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link
              href={`/profesional/${candidate.slug}`}
              onClick={onProfileClick}
              className="text-primary text-sm font-medium hover:underline"
            >
              Zobrazit profil
            </Link>

            {isDismissed ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={onRestore}
              >
                Obnovit
              </Button>
            ) : (
              <>
                {!isShortlisted ? (
                  <Button size="sm" disabled={pending} onClick={onShortlist}>
                    Uložit do výběru
                  </Button>
                ) : null}

                {requestVisibility === "private" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={onInvite}
                  >
                    Oslovit
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/poptavka/${recommendation.requestId}`}
                      target="_blank"
                    >
                      Odkaz na poptávku
                    </Link>
                  </Button>
                )}

                {!isShortlisted ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={onDismiss}
                  >
                    Skrýt
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
