import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { parseBriefContent } from "@/features/brief/content";
import { listPublicPortfolioForUser } from "@/features/portfolio/queries";
import {
  computeProfileCompleteness,
  scoreCandidate,
  type ScoringCandidate,
} from "./scoring";
import { canTransitionMatchStatus } from "./status";
import type {
  EmptyMatchReason,
  MatchCandidateBadge,
  MatchCandidateCard,
  MatchReason,
  MatchRecommendationStatus,
  MatchRecommendationView,
} from "./types";

/**
 * Datová vrstva matching enginu (T028). Jediné místo sahající na
 * `db.matchRecommendation`. Nepočítá s oprávněními (ta řeší volající přes
 * `permissions.ts`, stejně jako u `features/requests`) — vynucuje ale
 * doménové invarianty:
 *
 *  - profese je TVRDÁ podmínka (kandidát bez shodné profese se do výpočtu
 *    vůbec nedostane, není jen nízko skórovaný);
 *  - konflikt zájmů (vlastník poptávky / člen jeho organizace) je vyloučen;
 *  - kandidát musí mít publikovaný profil a `acceptingRequests` (§ Validation);
 *  - přepočet je idempotentní — bezpečné volat opakovaně (publikace, budoucí
 *    „významná změna poptávky", i ruční trigger).
 */

type ProfileRow = Prisma.ProfessionalProfileGetPayload<{
  select: {
    userId: true;
    headline: true;
    bio: true;
    photoUrl: true;
    location: true;
    serviceAreas: true;
    specializations: true;
    projectTypes: true;
    availability: true;
    yearsOfExperience: true;
    pricingModel: true;
    professions: {
      select: {
        isPrimary: true;
        profession: { select: { slug: true; name: true } };
      };
    };
  };
}>;

function toView(
  row: Prisma.MatchRecommendationGetPayload<Record<string, never>>,
): MatchRecommendationView {
  return {
    id: row.id,
    requestId: row.requestId,
    candidateUserId: row.candidateUserId,
    score: row.score,
    reasons: row.reasons as unknown as MatchReason[],
    status: row.status as MatchRecommendationStatus,
    sponsored: row.sponsored,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Uživatelé vyloučení pro konflikt zájmů: vlastník sám + členové jeho organizací. */
async function findConflictedUserIds(
  ownerUserId: string,
): Promise<Set<string>> {
  const conflicted = new Set<string>([ownerUserId]);
  const memberships = await db.organizationMember.findMany({
    where: { userId: ownerUserId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return conflicted;

  const members = await db.organizationMember.findMany({
    where: { orgId: { in: orgIds } },
    select: { userId: true },
  });
  for (const m of members) conflicted.add(m.userId);
  return conflicted;
}

/**
 * Uživatelé s ≥1 ověřením typu telefon/e-mail (T011). Odvozeno z
 * `loadVerifiedBadges` (T029) — stejný dotaz, jen jiný tvar výstupu; držet dvě
 * nezávislé kopie stejného `where` by časem mohlo rozejít eligibilitu skórování
 * a zobrazené odznaky.
 */
async function loadVerifiedUserIds(userIds: string[]): Promise<Set<string>> {
  const badges = await loadVerifiedBadges(userIds);
  return new Set(badges.keys());
}

/** Počet publikovaných (nesmazaných) portfolio projektů na uživatele. */
async function loadPublishedPortfolioCounts(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.portfolioProject.findMany({
    where: {
      ownerUserId: { in: userIds },
      status: "published",
      deletedAt: null,
    },
    select: { ownerUserId: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.ownerUserId) continue;
    counts.set(row.ownerUserId, (counts.get(row.ownerUserId) ?? 0) + 1);
  }
  return counts;
}

/** Typ projektu poptávky z briefSnapshotu (`null`, není-li publikováno/uveden). */
function projectTypeFromSnapshot(
  snapshot: Prisma.JsonValue | null,
): string | null {
  if (!snapshot) return null;
  const content = parseBriefContent(snapshot);
  return content?.projectType ?? null;
}

/**
 * Najde kandidáty splňující tvrdý filtr (profese, publikovaný profil,
 * `acceptingRequests`, aktivní účet, bez konfliktu zájmů) a sestaví jejich
 * skórovací vstup. Čistě čtecí — nic nezapisuje.
 */
async function findEligibleCandidates(params: {
  ownerUserId: string;
  targetProfessionSlugs: string[];
}): Promise<ScoringCandidate[]> {
  const conflicted = await findConflictedUserIds(params.ownerUserId);

  const profiles: ProfileRow[] = await db.professionalProfile.findMany({
    where: {
      status: "published",
      acceptingRequests: true,
      userId: { notIn: [...conflicted] },
      user: { status: "active" },
      professions: {
        some: { profession: { slug: { in: params.targetProfessionSlugs } } },
      },
    },
    select: {
      userId: true,
      headline: true,
      bio: true,
      photoUrl: true,
      location: true,
      serviceAreas: true,
      specializations: true,
      projectTypes: true,
      availability: true,
      yearsOfExperience: true,
      pricingModel: true,
      professions: {
        where: {
          profession: { slug: { in: params.targetProfessionSlugs } },
        },
        select: {
          isPrimary: true,
          profession: { select: { slug: true, name: true } },
        },
      },
    },
  });

  const userIds = profiles.map((p) => p.userId);
  const [verifiedIds, portfolioCounts] = await Promise.all([
    loadVerifiedUserIds(userIds),
    loadPublishedPortfolioCounts(userIds),
  ]);

  return profiles.map((p) => ({
    userId: p.userId,
    matchedProfessions: p.professions.map((pp) => ({
      slug: pp.profession.slug,
      name: pp.profession.name,
      isPrimary: pp.isPrimary,
    })),
    location: p.location,
    serviceAreas: p.serviceAreas,
    specializations: p.specializations,
    projectTypes: p.projectTypes,
    availability: p.availability,
    verified: verifiedIds.has(p.userId),
    publishedProjectCount: portfolioCounts.get(p.userId) ?? 0,
    completeness: computeProfileCompleteness(p),
  }));
}

export type RecomputeResult =
  { ok: true; candidateCount: number } | { ok: false; reason: "not_found" };

/**
 * Přepočte doporučení pro poptávku (§ Main flow bod 5 — trigger: publikace;
 * přepočet při významné změně). Existující řádky aktualizuje (zachová stav
 * `shown`/`shortlisted`/`dismissed`); kandidáty, kteří přestali vyhovovat,
 * smaže — doporučení „staženo" (§ Edge cases). Idempotentní, bezpečné volat
 * opakovaně i bez reálné změny dat.
 */
export async function recomputeMatches(
  requestId: string,
): Promise<RecomputeResult> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      ownerUserId: true,
      region: true,
      targetProfessionSlugs: true,
      briefSnapshot: true,
    },
  });
  if (!request) return { ok: false, reason: "not_found" };

  const candidates = await findEligibleCandidates({
    ownerUserId: request.ownerUserId,
    targetProfessionSlugs: request.targetProfessionSlugs,
  });

  const projectType = projectTypeFromSnapshot(request.briefSnapshot);
  const scored = candidates.map((candidate) => ({
    userId: candidate.userId,
    ...scoreCandidate(candidate, { region: request.region, projectType }),
  }));

  for (const s of scored) {
    await db.matchRecommendation.upsert({
      where: {
        requestId_candidateUserId: {
          requestId,
          candidateUserId: s.userId,
        },
      },
      create: {
        requestId,
        candidateUserId: s.userId,
        score: s.score,
        reasons: s.reasons as unknown as Prisma.InputJsonValue,
      },
      update: {
        score: s.score,
        reasons: s.reasons as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Kandidáti, kteří už nevyhovují (odpublikování, konflikt, ...) — doporučení stažena.
  await db.matchRecommendation.deleteMany({
    where: {
      requestId,
      candidateUserId: { notIn: scored.map((s) => s.userId) },
    },
  });

  trackEvent("match_computed", {
    requestId,
    candidateCount: scored.length,
  });
  return { ok: true, candidateCount: scored.length };
}

export type GetRecommendationsResult =
  | { ok: false; reason: "not_found" }
  | {
      ok: true;
      recommendations: MatchRecommendationView[];
      /** Vyplněno PRÁVĚ KDYŽ je `recommendations` prázdné (§ Alternative flows). */
      emptyReason: EmptyMatchReason | null;
    };

/**
 * Načte doporučení k poptávce, seřazená dle skóre (stabilně — sekundárně dle
 * `candidateUserId`, § Alternative flows). Kandidáta, který mezitím přestal
 * vyhovovat (odpublikoval/deaktivoval profil, ztratil `acceptingRequests`),
 * vyfiltruje při čtení (lazy invalidace — stejný princip jako expirace
 * poptávky v T024) — doporučení je „staženo", i než proběhne další přepočet.
 */
export async function getRecommendations(
  requestId: string,
): Promise<GetRecommendationsResult> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true },
  });
  if (!request) return { ok: false, reason: "not_found" };

  const rows = await db.matchRecommendation.findMany({
    where: {
      requestId,
      candidateUser: {
        status: "active",
        professionalProfile: { status: "published", acceptingRequests: true },
      },
    },
    orderBy: [{ score: "desc" }, { candidateUserId: "asc" }],
  });

  const recommendations = rows.map(toView);
  return {
    ok: true,
    recommendations,
    emptyReason:
      recommendations.length === 0 ? "no_eligible_professionals" : null,
  };
}

/**
 * Vlastník, kandidát a stavy (doporučení + poptávky) — vstup pro oprávnění A
 * doménové invarianty v `actions.ts` (T029). Stavy jsou tu proto, aby
 * `inviteMatchCandidateAction` mohl odmítnout pozvání skrytého kandidáta nebo
 * poptávky mimo aktivní fázi, aniž by na to spoléhal jen klient (skryté
 * tlačítko v UI nikoho nezastaví, kdo zavolá akci přímo).
 */
export interface RecommendationContext {
  requestId: string;
  ownerUserId: string;
  candidateUserId: string;
  status: MatchRecommendationStatus;
  requestStatus: string;
}

/**
 * Načte kontext doporučení (vlastník poptávky + kandidát + stavy) potřebný
 * k ověření oprávnění a k pozvání kandidáta (T029). `actions.ts` s ním nesahá
 * na `db.matchRecommendation` přímo — jediné místo zůstává tahle service vrstva.
 */
export async function getRecommendationContext(
  recommendationId: string,
): Promise<RecommendationContext | null> {
  const row = await db.matchRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      requestId: true,
      candidateUserId: true,
      status: true,
      request: { select: { ownerUserId: true, status: true } },
    },
  });
  if (!row) return null;
  return {
    requestId: row.requestId,
    ownerUserId: row.request.ownerUserId,
    candidateUserId: row.candidateUserId,
    status: row.status as MatchRecommendationStatus,
    requestStatus: row.request.status,
  };
}

/**
 * Přesune čerstvá doporučení (`new`) do stavu `shown` — první zobrazení
 * vlastníkovi na detailu poptávky JE „shown" (§ States). Volá se při čtení
 * stránky (server), nikdy z klienta. Vrací doporučení s aktualizovaným stavem,
 * aby je UI vykreslilo konzistentně bez dalšího načtení.
 */
export async function markRecommendationsShown(
  requestId: string,
  recommendations: MatchRecommendationView[],
): Promise<MatchRecommendationView[]> {
  const newOnes = recommendations.filter((r) => r.status === "new");
  if (newOnes.length === 0) return recommendations;

  await db.matchRecommendation.updateMany({
    where: { id: { in: newOnes.map((r) => r.id) } },
    data: { status: "shown" },
  });
  trackEvent("match_shown", { requestId, count: newOnes.length });

  const shownIds = new Set(newOnes.map((r) => r.id));
  return recommendations.map((r) =>
    shownIds.has(r.id) ? { ...r, status: "shown" as const } : r,
  );
}

export type UpdateStatusResult =
  | { ok: true; view: MatchRecommendationView }
  | { ok: false; reason: "not_found" | "invalid_transition" };

/**
 * Provede stavový přechod doporučení (`new → shown → shortlisted | dismissed`,
 * § States). Neplatný přechod server odmítne. Oprávnění ověřuje volající.
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: MatchRecommendationStatus,
): Promise<UpdateStatusResult> {
  const row = await db.matchRecommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const from = row.status as MatchRecommendationStatus;
  if (!canTransitionMatchStatus(from, status)) {
    return { ok: false, reason: "invalid_transition" };
  }

  const updated = await db.matchRecommendation.update({
    where: { id: recommendationId },
    data: { status },
  });

  if (status === "shortlisted") {
    trackEvent("match_shortlisted", {
      recommendationId,
      requestId: row.requestId,
    });
  } else if (status === "dismissed") {
    trackEvent("match_dismissed", {
      recommendationId,
      requestId: row.requestId,
    });
  }

  return { ok: true, view: toView(updated) };
}

/** Krátký úryvek bia pro kartu (stejná logika jako `features/search/service.ts`). */
function snippet(bio: string | null): string | null {
  const text = bio?.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Ověřené badge (telefon/e-mail) na uživatele (stejný tvar jako `search/service.ts`). */
async function loadVerifiedBadges(
  userIds: string[],
): Promise<Map<string, MatchCandidateBadge[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.verification.findMany({
    where: {
      userId: { in: userIds },
      status: "verified",
      type: { in: ["phone", "email"] },
    },
    select: { userId: true, type: true },
  });
  const map = new Map<string, MatchCandidateBadge[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row.type as MatchCandidateBadge);
    map.set(row.userId, list);
  }
  return map;
}

/**
 * Hydratuje veřejné kandidátní karty (jméno, profese, region, portfolio,
 * ověření) k `candidateUserId` z doporučení (T029 § Main flow bod 1).
 * `MatchRecommendationView` sama nese jen ID — karta je oddělená hydratace,
 * stejný princip jako `hydrateCards` v `features/search/service.ts`, jen
 * klíčovaná `userId` místo `profile.id`. Kandidát bez slugu (profil bez
 * publikace) se v mapě neobjeví — na kartu nemá kam odkázat.
 */
export async function hydrateMatchCandidates(
  candidateUserIds: string[],
): Promise<Map<string, MatchCandidateCard>> {
  if (candidateUserIds.length === 0) return new Map();

  const [profiles, badgesByUser] = await Promise.all([
    db.professionalProfile.findMany({
      where: { userId: { in: candidateUserIds } },
      select: {
        userId: true,
        slug: true,
        headline: true,
        bio: true,
        location: true,
        serviceAreas: true,
        professions: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            isPrimary: true,
            profession: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    loadVerifiedBadges(candidateUserIds),
  ]);

  // `allSettled`, ne `all`: selhání portfolia jednoho kandidáta (výpadek DB,
  // poškozený snapshot) nesmí strhnout hydrataci celé stránky — takový
  // kandidát prostě v mapě chybí, stejně jako kandidát bez slugu.
  const settled = await Promise.allSettled(
    profiles
      .filter((p): p is typeof p & { slug: string } => p.slug !== null)
      .map(async (p): Promise<[string, MatchCandidateCard]> => {
        const portfolio = await listPublicPortfolioForUser(p.userId);
        return [
          p.userId,
          {
            candidateUserId: p.userId,
            slug: p.slug,
            headline: p.headline?.trim() || "Profesionál",
            professions: p.professions.map((link) => ({
              slug: link.profession.slug,
              name: link.profession.name,
              isPrimary: link.isPrimary,
            })),
            location: p.location,
            region: p.serviceAreas[0] ?? null,
            bioSnippet: snippet(p.bio),
            portfolioCoverUrl: portfolio[0]?.coverImageUrl ?? null,
            publishedProjectCount: portfolio.length,
            badges: badgesByUser.get(p.userId) ?? [],
          },
        ];
      }),
  );

  const entries = settled
    .filter(
      (r): r is PromiseFulfilledResult<[string, MatchCandidateCard]> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  return new Map(entries);
}
