import { BadgeCheck, Images, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VERIFICATION_LABELS } from "@/features/verification/rules";
import { TrackedLink } from "./tracked-link";
import type { ProfessionalCard as Card_ } from "../types";

/**
 * Karta profilu ve výsledcích vyhledávání (T034 § Main flow #3). Zobrazuje jen
 * veřejná pole — headline, profese, region, úryvek bia, náhled portfolia a
 * PŘESNÝ ověřovací badge (např. „Ověřený telefon"), nikdy paušální „Verified
 * Professional" (zadani/12 §3). Žádná privátní pole (adresa, kontakty).
 */
export function ProfessionalCard({ card }: { card: Card_ }) {
  const primary =
    card.professions.find((p) => p.isPrimary) ?? card.professions[0];
  const others = card.professions.filter((p) => p !== primary);
  const place = card.location ?? card.region;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <TrackedLink
        href={`/profesional/${card.slug}`}
        event="search_result_clicked"
        payload={{ slug: card.slug }}
        className="focus-visible:ring-ring block focus-visible:ring-2 focus-visible:outline-none"
      >
        {card.portfolioCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- náhled portfolia (externí/chráněná URL), Image optim. řeší T016
          <img
            src={card.portfolioCoverUrl}
            alt=""
            className="bg-muted aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex aspect-[16/9] w-full items-center justify-center">
            <Images className="size-8" aria-hidden />
          </div>
        )}
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="leading-snug font-semibold">{card.headline}</h3>
          </div>

          {primary && (
            <p className="text-muted-foreground text-sm">
              {primary.name}
              {others.length > 0 && (
                <span className="text-muted-foreground/70">
                  {" "}
                  + {others.length} další
                </span>
              )}
            </p>
          )}

          {place && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place}
            </p>
          )}

          {card.bioSnippet && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {card.bioSnippet}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {card.badges.map((badge) => (
              <Badge key={badge} variant="success" className="gap-1">
                <BadgeCheck className="size-3.5" aria-hidden />
                {VERIFICATION_LABELS[badge]}
              </Badge>
            ))}
            {card.publishedProjectCount > 0 && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Images className="size-3.5" aria-hidden />
                {card.publishedProjectCount} v portfoliu
              </span>
            )}
          </div>
        </CardContent>
      </TrackedLink>
    </Card>
  );
}
