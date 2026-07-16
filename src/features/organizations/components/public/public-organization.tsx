import Link from "next/link";
import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORG_ROLE_LABELS } from "../../types";
import type { PublicOrganizationView } from "../../queries";
import type { PublicPortfolioCard } from "@/features/portfolio/queries";
import { PortfolioProjectGrid } from "@/features/portfolio/components/public/portfolio-project-grid";
import { ReviewSection } from "@/features/reviews/components/public/review-section";
import type { ReviewAggregate, ReviewView } from "@/features/reviews/types";
import { ExpandableText } from "./expandable-text";

/** Iniciály pro logo-fallback (edge case: firma bez loga). */
function initials(source: string): string {
  const words = source.trim().split(/\s+/).filter(Boolean);
  const letters = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

/** Sekce s nadpisem — volá se jen s obsahem (prázdné se nezobrazují). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Skupina „štítků" (specializace, regiony…). */
function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function PublicOrganization({
  org,
  projects = [],
  reviews = null,
  isEditor = false,
}: {
  org: PublicOrganizationView;
  /** Publikované projekty firmy (T016 § Main flow #4). */
  projects?: PublicPortfolioCard[];
  /** Hodnocení firmy (T037) — výsledek `getReviewsForTarget`. */
  reviews?: { aggregate: ReviewAggregate; reviews: ReviewView[] } | null;
  /** Je návštěvník editor+ firmy? Odemyká reply/dispute na recenzích (T037). */
  isEditor?: boolean;
}) {
  const hasContact =
    !!org.contact.email || !!org.contact.phone || !!org.contact.website;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Hlavní sloupec */}
        <div className="space-y-6">
          {/* Hlavička firmy */}
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:gap-6">
              <Avatar className="size-20 shrink-0 rounded-lg sm:size-24">
                {org.logoUrl && <AvatarImage src={org.logoUrl} alt="" />}
                <AvatarFallback className="rounded-lg text-xl">
                  {initials(org.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {org.name}
                </h1>

                <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {org.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4" aria-hidden />
                      <dt className="sr-only">Sídlo</dt>
                      <dd>{org.location}</dd>
                    </div>
                  )}
                  {org.serviceAreas.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Působnost</dt>
                      <dd>Působnost: {org.serviceAreas.join(", ")}</dd>
                    </div>
                  )}
                </dl>

                {org.specializations.length > 0 && (
                  <Chips items={org.specializations} />
                )}
              </div>
            </CardContent>
          </Card>

          {org.description?.trim() && (
            <Section title="O firmě">
              <ExpandableText text={org.description} />
            </Section>
          )}

          {/* Tým — jen členové s opt-inem; prázdná sekce se skryje. */}
          {org.team.length > 0 && (
            <Section title="Tým">
              <ul className="grid gap-3 sm:grid-cols-2">
                {org.team.map((member, i) => {
                  const inner = (
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11 shrink-0">
                        {member.photoUrl && (
                          <AvatarImage src={member.photoUrl} alt="" />
                        )}
                        <AvatarFallback>{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {ORG_ROLE_LABELS[member.role]}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={member.href ?? `${member.name}-${i}`}>
                      {member.href ? (
                        <Link
                          href={member.href}
                          className="hover:bg-muted/50 block rounded-lg border p-3 transition-colors"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="rounded-lg border p-3">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Portfolio (T016) — publikované projekty firmy. */}
          {projects.length > 0 && (
            <Section title="Portfolio">
              <PortfolioProjectGrid projects={projects} />
            </Section>
          )}

          {/* Hodnocení (T037) — jen s daty (prázdná sekce se nezobrazuje). */}
          {reviews && reviews.reviews.length > 0 && (
            <Section title="Hodnocení">
              <ReviewSection
                aggregate={reviews.aggregate}
                reviews={reviews.reviews}
                isOwner={isEditor}
              />
            </Section>
          )}

          {/*
            Sloty pro budoucí sekce — vykreslí je až příslušné tasky: služby a
            pracovní nabídky. Dokud nemají data, sekce se nezobrazují (T010 § Main flow).
          */}
        </div>

        {/* Postranní sloupec: kontakt firmy (jen když ho owner zveřejnil) */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {hasContact && (
            <Section title="Kontakt">
              <dl className="space-y-2 text-sm">
                {org.contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted-foreground size-4" aria-hidden />
                    <dt className="sr-only">E-mail</dt>
                    <dd>
                      <a
                        href={`mailto:${org.contact.email}`}
                        className="hover:text-foreground break-all underline"
                      >
                        {org.contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {org.contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone
                      className="text-muted-foreground size-4"
                      aria-hidden
                    />
                    <dt className="sr-only">Telefon</dt>
                    <dd>{org.contact.phone}</dd>
                  </div>
                )}
                {org.contact.website && (
                  <div className="flex items-center gap-2">
                    <Globe
                      className="text-muted-foreground size-4"
                      aria-hidden
                    />
                    <dt className="sr-only">Web</dt>
                    <dd>
                      <a
                        href={org.contact.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-foreground break-all underline"
                      >
                        {org.contact.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </Section>
          )}
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
            <Building2 className="size-3.5" aria-hidden />
            Firemní profil na ArchiGuide
          </div>
        </aside>
      </div>
    </main>
  );
}
