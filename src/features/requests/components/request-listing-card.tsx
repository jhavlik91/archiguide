import Link from "next/link";
import { Calendar, MapPin, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { publicRequestPath } from "../paths";
import { REQUEST_TYPE_LABELS } from "../types";
import type { RequestListingCard as ListingCard } from "../listing-types";

/**
 * Karta poptávky ve veřejném výpisu (T026 § Main flow #1). Jen anonymizovaná
 * pole (žádná identita zadavatele) — stejný whitelist princip jako detail
 * (T025 §20.2). Klik vede na `/poptavka/[id]`.
 */
export function RequestListingCard({ card }: { card: ListingCard }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link
        href={publicRequestPath(card.id)}
        className="focus-visible:ring-ring block focus-visible:ring-2 focus-visible:outline-none"
      >
        <CardContent className="space-y-2 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="leading-snug font-semibold">{card.title}</h3>
            <Badge variant="outline" className="shrink-0">
              {REQUEST_TYPE_LABELS[card.type]}
            </Badge>
          </div>

          {card.professionNames.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {card.professionNames.join(", ")}
            </p>
          )}

          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {card.region}
          </p>

          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            {card.budget && (
              <span className="flex items-center gap-1">
                <Wallet className="size-3.5 shrink-0" aria-hidden />
                {card.budget}
              </span>
            )}
            {card.deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 shrink-0" aria-hidden />
                {new Date(card.deadline).toLocaleDateString("cs-CZ")}
              </span>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
