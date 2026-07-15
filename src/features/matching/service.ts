import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { parseBriefContent } from "@/features/brief/content";
import {
  computeProfileCompleteness,
  scoreCandidate,
  type ScoringCandidate,
} from "./scoring";
import { canTransitionMatchStatus } from "./status";
import type {
  EmptyMatchReason,
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

/** Uživatelé s ≥1 ověřením typu telefon/e-mail (T011). */
async function loadVerifiedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db.verification.findMany({
    where: {
      userId: { in: userIds },
      status: "verified",
      type: { in: ["phone", "email"] },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
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
