/**
 * Čistá skórovací logika matching enginu (T028 § Main flow, legacy-master-spec
 * §21). Bez DB — kandidát sem přichází už po tvrdém filtru profese a konfliktu
 * zájmů (`service.ts`); tahle vrstva jen počítá skóre a staví ≥1 strukturovaný
 * důvod (§ acceptance: „doporučení bez alespoň jednoho důvodu nevznikne").
 *
 * Skóre je čistě interní pořadové číslo — NIKDY se nevystavuje jako procento
 * přesnosti (zadani/16 §5). Nový profesionál bez recenzí není touto vrstvou
 * nijak penalizován: hodnocení (T037) je slot, který v MVP prostě neexistuje —
 * kritérium se tedy převáží (chybí), ne vynuluje (§ Edge cases).
 */

// Přímý import z čistého submodulu (ne z barrelu `@/features/taxonomy`), který
// by přes `queries.ts` natáhl `@/lib/db` i do tohoto čistého, bez-DB modulu.
import { normalize } from "@/features/taxonomy/match";
import { COMPLETENESS_TIE_BREAK_EPSILON, MATCH_WEIGHTS } from "./config";
import type { MatchReason } from "./types";

/** Dostupnost kandidáta (zrcadlí `Availability` z T007, bez importu domény). */
export type CandidateAvailability = "open" | "limited" | "unavailable" | null;

/** Jedna profese kandidáta, která odpovídá cílovým profesím poptávky. */
export interface MatchedProfession {
  slug: string;
  name: string;
  isPrimary: boolean;
}

/** Vstup skórování pro jednoho kandidáta — už po tvrdém filtru profese. */
export interface ScoringCandidate {
  userId: string;
  /** Profese kandidáta, které se protnuly s cílovými profesemi poptávky (≥1). */
  matchedProfessions: MatchedProfession[];
  location: string | null;
  serviceAreas: string[];
  specializations: string[];
  projectTypes: string[];
  availability: CandidateAvailability;
  verified: boolean;
  /** Počet publikovaných portfolio projektů kandidáta. */
  publishedProjectCount: number;
  /** Kompletnost profilu (0..9 bodů) — jen pro deterministický tie-break. */
  completeness: number;
}

/** Vstup skórování ze strany poptávky. */
export interface ScoringRequest {
  region: string;
  /** Typ projektu poptávky (z briefSnapshotu), nebo `null` (neuveden). */
  projectType: string | null;
}

export interface ScoreResult {
  score: number;
  /** Vždy ≥1 položka — `profession_match` vzniká vždy (kandidát prošel filtrem). */
  reasons: MatchReason[];
}

/** Obsahuje některá položka seznamu (normalizovaně, oboustranná podmnožina) `needle`? */
function textListMatches(list: readonly string[], needle: string): boolean {
  const n = normalize(needle);
  if (!n) return false;
  return list.some((item) => {
    const normItem = normalize(item);
    return (
      normItem.length > 0 && (normItem.includes(n) || n.includes(normItem))
    );
  });
}

/** Skloňování „projekt/projekty/projektů" pro lidský text důvodu. */
function projectWord(count: number): string {
  if (count === 1) return "projekt";
  if (count >= 2 && count <= 4) return "projekty";
  return "projektů";
}

/** Vstup pro výpočet kompletnosti profilu (podmnožina polí `ProfessionalProfile`). */
export interface CompletenessInput {
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  location: string | null;
  serviceAreas: string[];
  specializations: string[];
  projectTypes: string[];
  yearsOfExperience: number | null;
  pricingModel: string | null;
}

/**
 * Kompletnost profilu jako celé číslo 0..9 (počet vyplněných polí). Slouží jen
 * jako stabilní tie-break při rovnosti skóre (§ Alternative flows) — NIKDY
 * nerozhoduje o hlavním pořadí.
 */
export function computeProfileCompleteness(profile: CompletenessInput): number {
  let n = 0;
  if (profile.headline?.trim()) n++;
  if (profile.bio?.trim()) n++;
  if (profile.photoUrl) n++;
  if (profile.location?.trim()) n++;
  if (profile.serviceAreas.length > 0) n++;
  if (profile.specializations.length > 0) n++;
  if (profile.projectTypes.length > 0) n++;
  if (profile.yearsOfExperience != null) n++;
  if (profile.pricingModel != null) n++;
  return n;
}

/**
 * Spočítá skóre a důvody pro jednoho kandidáta (§ Main flow bod 2–4).
 * Kandidát MUSÍ mít ≥1 shodnou profesi (tvrdý filtr proběhl už ve `service.ts`
 * — profese je vyloučena z konfigurovatelných vah, protože je to podmínka, ne
 * odstupňované kritérium, zadani/16 §5 „profese je tvrdá podmínka").
 */
export function scoreCandidate(
  candidate: ScoringCandidate,
  request: ScoringRequest,
): ScoreResult {
  let score = 0;
  const reasons: MatchReason[] = [];

  // --- Profese (vždy vzniká — kandidát prošel tvrdým filtrem) ---------------
  const primaryMatch = candidate.matchedProfessions.find((p) => p.isPrimary);
  const professionNames = candidate.matchedProfessions
    .map((p) => p.name)
    .join(", ");
  if (primaryMatch) {
    score += MATCH_WEIGHTS.professionPrimary;
    reasons.push({
      type: "profession_match",
      detail: `Hlavní profese: ${professionNames}.`,
    });
  } else {
    score += MATCH_WEIGHTS.professionSecondary;
    reasons.push({
      type: "profession_match",
      detail: `Vedlejší profese: ${professionNames}.`,
    });
  }

  // --- Specializace vs. typ projektu poptávky --------------------------------
  if (
    request.projectType &&
    textListMatches(candidate.specializations, request.projectType)
  ) {
    score += MATCH_WEIGHTS.specializationMatch;
    reasons.push({
      type: "specialization",
      detail: `Specializuje se na „${request.projectType}".`,
    });
  }

  // --- Region -----------------------------------------------------------------
  const regionMatch =
    request.region.trim().length > 0 &&
    ((candidate.location != null &&
      textListMatches([candidate.location], request.region)) ||
      textListMatches(candidate.serviceAreas, request.region));
  if (regionMatch) {
    score += MATCH_WEIGHTS.regionMatch;
    reasons.push({
      type: "region",
      detail: `Působí v regionu ${request.region}.`,
    });
  }

  // --- Podobné projekty (typ projektu vs. portfolio/typické zakázky) --------
  const projectTypeMatch = request.projectType
    ? textListMatches(candidate.projectTypes, request.projectType)
    : false;
  if (projectTypeMatch && candidate.publishedProjectCount > 0) {
    score += MATCH_WEIGHTS.similarProjectsMatch;
    reasons.push({
      type: "similar_projects",
      detail: `Realizoval ${candidate.publishedProjectCount} ${projectWord(
        candidate.publishedProjectCount,
      )} typu „${request.projectType}".`,
    });
  } else if (candidate.publishedProjectCount > 0) {
    score += MATCH_WEIGHTS.publishedPortfolioBonus;
    reasons.push({
      type: "similar_projects",
      detail: `Má publikováno ${candidate.publishedProjectCount} ${projectWord(
        candidate.publishedProjectCount,
      )} v portfoliu.`,
    });
  }

  // --- Ověření (bez vlastního důvodu — jen tichý bonus) ----------------------
  if (candidate.verified) {
    score += MATCH_WEIGHTS.verifiedBonus;
  }

  // --- Dostupnost — penalizuje, NIKDY nevylučuje (§ Edge cases) --------------
  if (candidate.availability === "unavailable") {
    score += MATCH_WEIGHTS.unavailablePenalty;
    reasons.push({
      type: "limited_availability",
      detail: "Aktuálně nepřijímá nové zakázky.",
    });
  } else if (candidate.availability === "limited") {
    score += MATCH_WEIGHTS.limitedAvailabilityPenalty;
    reasons.push({
      type: "limited_availability",
      detail: "Má omezenou kapacitu.",
    });
  }

  // --- Deterministický tie-break (nikdy nepřeváží reálnou shodu) -------------
  score += candidate.completeness * COMPLETENESS_TIE_BREAK_EPSILON;

  return { score, reasons };
}
