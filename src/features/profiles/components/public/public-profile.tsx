import Link from "next/link";
import { CalendarClock, Languages, MapPin, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AVAILABILITY_LABELS,
  COLLABORATION_FORM_LABELS,
  PRICING_MODEL_LABELS,
} from "../../types";
import type { PublicProfile } from "../../service";
import type { PublicPortfolioCard } from "@/features/portfolio/queries";
import { PortfolioProjectGrid } from "@/features/portfolio/components/public/portfolio-project-grid";
import { ReviewSection } from "@/features/reviews/components/public/review-section";
import type { ReviewAggregate, ReviewView } from "@/features/reviews/types";
import { ContactCta } from "./contact-cta";
import { ExpandableText } from "./expandable-text";

/** Iniciály pro avatar bez fotky (edge case: profil bez fota). */
function initials(source: string): string {
  const words = source.trim().split(/\s+/).filter(Boolean);
  const letters = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

/** Česká pluralizace „rok/roky/let" podle počtu. */
function yearsLabel(n: number): string {
  if (n === 1) return "rok";
  if (n >= 2 && n <= 4) return "roky";
  return "let";
}

const availabilityVariant = {
  open: "success",
  limited: "warning",
  unavailable: "secondary",
} as const;

/** Sekce s nadpisem — vykreslí se jen s obsahem (prázdné se nezobrazují). */
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

/** Skupina „štítků" (specializace, typy projektů, jazyky…). */
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

export function PublicProfile({
  profile,
  mode,
  isOwner,
  isAuthenticated,
  projects = [],
  reviews = null,
}: {
  profile: PublicProfile;
  mode: "public" | "preview";
  isOwner: boolean;
  isAuthenticated: boolean;
  /** Publikované projekty profesionála (T016 § Main flow #4). */
  projects?: PublicPortfolioCard[];
  /** Hodnocení profesionála (T037) — výsledek `getReviewsForTarget`. */
  reviews?: { aggregate: ReviewAggregate; reviews: ReviewView[] } | null;
}) {
  const primary = profile.professions.find((p) => p.isPrimary);
  const secondary = profile.professions.filter((p) => !p.isPrimary);
  const title = profile.headline?.trim() || "Profesionál";

  const hasExpertise =
    profile.yearsOfExperience != null ||
    profile.specializations.length > 0 ||
    profile.projectTypes.length > 0;
  const hasAvailability =
    profile.availability != null ||
    profile.collaborationForms.length > 0 ||
    profile.pricingModel != null ||
    !!profile.pricingNote;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Vlastníkovské lišty: náhled draftu / odkaz na editaci. */}
      {mode === "preview" && (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <span>
            <strong>Náhled draftu.</strong> Takto profil uvidí veřejnost po
            publikaci. Zatím není nikomu jinému viditelný.
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href="/profile">Upravit profil</Link>
          </Button>
        </div>
      )}
      {mode === "public" && isOwner && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="outline" asChild>
            <Link href="/profile">
              <Pencil className="size-4" /> Upravit profil
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Hlavní sloupec */}
        <div className="space-y-6">
          {/* Hlavička vizitky */}
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:gap-6">
              <Avatar className="size-20 shrink-0 sm:size-24">
                {profile.photoUrl && (
                  <AvatarImage src={profile.photoUrl} alt="" />
                )}
                <AvatarFallback className="text-xl">
                  {initials(title)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-3">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                  </h1>
                  {primary && (
                    <p className="text-muted-foreground">
                      {primary.profession.name}
                    </p>
                  )}
                </div>

                {secondary.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {secondary.map((p) => (
                      <Badge key={p.profession.id} variant="outline">
                        {p.profession.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {profile.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4" aria-hidden />
                      <dd>{profile.location}</dd>
                    </div>
                  )}
                  {profile.serviceAreas.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Působnost</dt>
                      <dd>Působnost: {profile.serviceAreas.join(", ")}</dd>
                    </div>
                  )}
                  {profile.languages.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Languages className="size-4" aria-hidden />
                      <dt className="sr-only">Jazyky</dt>
                      <dd>{profile.languages.join(", ")}</dd>
                    </div>
                  )}
                </dl>

                {profile.availability && (
                  <Badge variant={availabilityVariant[profile.availability]}>
                    {AVAILABILITY_LABELS[profile.availability]}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {profile.bio?.trim() && (
            <Section title="O mně">
              <ExpandableText text={profile.bio} />
            </Section>
          )}

          {hasExpertise && (
            <Section title="Odbornost">
              <div className="space-y-4">
                {profile.yearsOfExperience != null && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Praxe: </span>
                    {profile.yearsOfExperience}{" "}
                    {yearsLabel(profile.yearsOfExperience)}
                  </p>
                )}
                {profile.specializations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Specializace
                    </p>
                    <Chips items={profile.specializations} />
                  </div>
                )}
                {profile.projectTypes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Typy projektů
                    </p>
                    <Chips items={profile.projectTypes} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {hasAvailability && (
            <Section title="Dostupnost a spolupráce">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {profile.availability && (
                  <div>
                    <dt className="text-muted-foreground">Dostupnost</dt>
                    <dd>{AVAILABILITY_LABELS[profile.availability]}</dd>
                  </div>
                )}
                {profile.collaborationForms.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground">Forma spolupráce</dt>
                    <dd>
                      {profile.collaborationForms
                        .map((f) => COLLABORATION_FORM_LABELS[f])
                        .join(", ")}
                    </dd>
                  </div>
                )}
                {profile.pricingModel && (
                  <div>
                    <dt className="text-muted-foreground">Cenový model</dt>
                    <dd>{PRICING_MODEL_LABELS[profile.pricingModel]}</dd>
                  </div>
                )}
                {profile.pricingNote && (
                  <div>
                    <dt className="text-muted-foreground">Poznámka k ceně</dt>
                    <dd>{profile.pricingNote}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}

          {/* Portfolio (T016) — publikované projekty profesionála. */}
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
                isOwner={isOwner}
              />
            </Section>
          )}

          {/*
            Sloty pro budoucí sekce — vykreslí je až příslušné tasky:
            verifikační badge (T011), služby.
            Dokud nemají data, sekce se nezobrazují (T008 § Main flow).
          */}
        </div>

        {/* Postranní sloupec: kontakt + dostupnost */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <ContactCta
            isAuthenticated={isAuthenticated}
            acceptingRequests={profile.acceptingRequests}
          />
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
            <CalendarClock className="size-3.5" aria-hidden />
            Profil na ArchiGuide
          </div>
        </aside>
      </div>
    </main>
  );
}
