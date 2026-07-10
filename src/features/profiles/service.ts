import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeProfessionLinks, canAcceptRequests, canPublish } from "./rules";
import type {
  AvailabilityInput,
  BasicsInput,
  ExpertiseInput,
  PricingInput,
} from "./validation";
import type { ProfessionLink } from "./types";

/**
 * Datová vrstva profilů (T007). Jediné místo, které sahá na `db.professionalProfile`
 * a `db.profileProfession`. Business pravidla (právě jedna hlavní profese, aktivace
 * příjmu poptávek jen s profesí, podmínky publikace) se vynucují tady na serveru;
 * oprávnění (kdo smí editovat) řeší `actions.ts` přes permission vrstvu.
 */

/** Profil i s profesemi (a jejich taxonomií) — sdílený tvar pro čtení. */
const profileInclude = {
  professions: {
    include: { profession: { include: { category: true } } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ProfessionalProfileInclude;

export type ProfileWithProfessions = Prisma.ProfessionalProfileGetPayload<{
  include: typeof profileInclude;
}>;

/** Výsledek operace s doménovým pravidlem. */
export type ServiceResult =
  | { ok: true }
  | { ok: false; error: "no_profession" | "cannot_publish" | "unknown_profession" };

/** Profil uživatele i s profesemi, nebo `null`. */
export function getProfileByUserId(
  userId: string,
): Promise<ProfileWithProfessions | null> {
  return db.professionalProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });
}

/**
 * Vrátí profil vlastníka; pokud neexistuje, založí prázdný draft. `created`
 * signalizuje první založení (pro analytics `profile.created` v akci).
 */
export async function getOrCreateDraft(
  userId: string,
): Promise<{ profile: ProfileWithProfessions; created: boolean }> {
  const existing = await getProfileByUserId(userId);
  if (existing) return { profile: existing, created: false };

  try {
    const profile = await db.professionalProfile.create({
      data: { userId },
      include: profileInclude,
    });
    return { profile, created: true };
  } catch (error) {
    // Souběžné první akce: prohrávající create narazí na unikát userId —
    // draft mezitím založil někdo jiný, jen ho dočti.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const profile = await getProfileByUserId(userId);
      if (profile) return { profile, created: false };
    }
    throw error;
  }
}

/** Aktuální počet profesí profilu (0, pokud profil neexistuje). */
async function professionCount(userId: string): Promise<number> {
  const profile = await db.professionalProfile.findUnique({
    where: { userId },
    select: { _count: { select: { professions: true } } },
  });
  return profile?._count.professions ?? 0;
}

/** Uloží sekci „základ". */
export async function updateBasics(
  userId: string,
  input: BasicsInput,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: {
      headline: input.headline ?? null,
      photoUrl: input.photoUrl ?? null,
      bio: input.bio ?? null,
      location: input.location ?? null,
      serviceAreas: input.serviceAreas,
      languages: input.languages,
    },
  });
}

/** Uloží sekci „odbornost" (bez profesí — ty mají vlastní operaci). */
export async function updateExpertise(
  userId: string,
  input: ExpertiseInput,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: {
      yearsOfExperience: input.yearsOfExperience ?? null,
      specializations: input.specializations,
      projectTypes: input.projectTypes,
    },
  });
}

/** Uloží sekci „dostupnost". */
export async function updateAvailability(
  userId: string,
  input: AvailabilityInput,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: {
      availability: input.availability ?? null,
      collaborationForms: input.collaborationForms,
    },
  });
}

/** Uloží sekci „ceny". */
export async function updatePricing(
  userId: string,
  input: PricingInput,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: {
      pricingModel: input.pricingModel ?? null,
      pricingNote: input.pricingNote ?? null,
    },
  });
}

/**
 * Přepíše výběr profesí. Ověří, že profese existují v taxonomii (T005) a že nově
 * přidané nejsou archivované (archivovanou lze ponechat, pokud už byla použitá —
 * edge case archivace adminem). Normalizuje hlavní profesi a přepíše join atomicky.
 * Když by profil zůstal bez profese, vypne příjem poptávek (nelze bez profese).
 */
export async function setProfessions(
  userId: string,
  requested: readonly ProfessionLink[],
): Promise<ServiceResult> {
  const profile = await db.professionalProfile.findUnique({
    where: { userId },
    include: { professions: { select: { professionId: true } } },
  });
  if (!profile) return { ok: false, error: "unknown_profession" };

  const links = normalizeProfessionLinks(requested);
  const requestedIds = links.map((l) => l.professionId);

  if (requestedIds.length > 0) {
    const known = await db.profession.findMany({
      where: { id: { in: requestedIds } },
      select: { id: true, status: true },
    });
    const knownById = new Map(known.map((p) => [p.id, p.status]));
    const alreadyLinked = new Set(
      profile.professions.map((p) => p.professionId),
    );
    for (const id of requestedIds) {
      const status = knownById.get(id);
      // Neznámá profese, nebo nově přidaná archivovaná → odmítnout.
      if (!status) return { ok: false, error: "unknown_profession" };
      if (status === "archived" && !alreadyLinked.has(id)) {
        return { ok: false, error: "unknown_profession" };
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.profileProfession.deleteMany({ where: { profileId: profile.id } });
    if (links.length > 0) {
      await tx.profileProfession.createMany({
        data: links.map((l) => ({
          profileId: profile.id,
          professionId: l.professionId,
          isPrimary: l.isPrimary,
        })),
      });
    }
    // Bez profese nelze přijímat poptávky — udrž invariant.
    if (links.length === 0) {
      await tx.professionalProfile.update({
        where: { id: profile.id },
        data: { acceptingRequests: false },
      });
    }
  });

  return { ok: true };
}

/**
 * Onboarding ukládá po jednotlivých polích (na rozdíl od editoru, který ukládá
 * celou sekci). Tyto úzké updaty proto přepisují právě jedno pole a nemažou
 * ostatní rozpracovaná data — draft se návratem do wizardu neztratí.
 */
export async function updateOnboardingLocation(
  userId: string,
  location: string | null,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: { location },
  });
}

export async function updateOnboardingSpecializations(
  userId: string,
  specializations: string[],
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: { specializations },
  });
}

export async function updateOnboardingAvailability(
  userId: string,
  availability: AvailabilityInput["availability"] | null,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: { availability: availability ?? null },
  });
}

/** Uloží pokrok onboarding wizardu (monotónně roste — návrat pak pokračuje). */
export async function setOnboardingStep(
  userId: string,
  step: number,
): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: { onboardingStep: { set: step } },
  });
}

/** Publikuje profil (draft → published), pokud splňuje podmínky publikace. */
export async function publishProfile(userId: string): Promise<ServiceResult> {
  const profile = await db.professionalProfile.findUnique({
    where: { userId },
    select: {
      headline: true,
      publishedAt: true,
      _count: { select: { professions: true } },
    },
  });
  if (!profile) return { ok: false, error: "cannot_publish" };

  if (
    !canPublish({
      headline: profile.headline,
      professionCount: profile._count.professions,
    })
  ) {
    return { ok: false, error: "cannot_publish" };
  }

  await db.professionalProfile.update({
    where: { userId },
    data: {
      status: "published",
      // publishedAt nastav jen při první publikaci (přežije i unpublish).
      ...(profile.publishedAt ? {} : { publishedAt: new Date() }),
    },
  });
  return { ok: true };
}

/** Vrátí publikovaný profil zpět do draftu (skryje ho z veřejnosti). */
export async function unpublishProfile(userId: string): Promise<void> {
  await db.professionalProfile.update({
    where: { userId },
    data: { status: "draft" },
  });
}

/**
 * Přepne „přijímám poptávky". Zapnout lze jen s ≥1 profesí (T007 § Validation).
 * Vypnutí je vždy povolené.
 */
export async function setAcceptingRequests(
  userId: string,
  accepting: boolean,
): Promise<ServiceResult> {
  if (accepting && !canAcceptRequests(await professionCount(userId))) {
    return { ok: false, error: "no_profession" };
  }
  await db.professionalProfile.update({
    where: { userId },
    data: { acceptingRequests: accepting },
  });
  return { ok: true };
}
