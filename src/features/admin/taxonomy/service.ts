import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { slugify } from "@/features/taxonomy";
import { writeAuditLog } from "../audit";
import { countProfessionUsage } from "./queries";
import type { CategoryInput, ProfessionInput } from "./validation";

/**
 * Mutace admin správy taxonomie (T035 § Main flow 4). Kategorie/profese se
 * archivují, ne mažou, dokud je používá profil (`ProfileProfession` má FK
 * `onDelete: Restrict` — DB by smazání stejně odmítla, tady to jen předem
 * ověříme, abychom vrátili srozumitelnou chybu s počtem referencí).
 */

export type TaxonomyActionResult =
  | { ok: true; id: string }
  | { ok: false; error: "duplicate_slug" | "in_use"; usageCount?: number };

async function reserveUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}

// --- Kategorie ---------------------------------------------------------------

export async function createCategory(
  actorUserId: string,
  input: CategoryInput,
): Promise<TaxonomyActionResult> {
  const slug = await reserveUniqueSlug(input.name, async (candidate) => {
    const existing = await db.professionCategory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  const category = await db.professionCategory.create({
    data: { name: input.name, slug, position: input.position },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_category_created",
    targetType: "profession_category",
    targetId: category.id,
    metadata: { name: input.name },
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "category_created",
    targetId: category.id,
  });
  return { ok: true, id: category.id };
}

export async function updateCategory(
  actorUserId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<TaxonomyActionResult> {
  await db.professionCategory.update({
    where: { id: categoryId },
    data: { name: input.name, position: input.position },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_category_updated",
    targetType: "profession_category",
    targetId: categoryId,
    metadata: { name: input.name },
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "category_updated",
    targetId: categoryId,
  });
  return { ok: true, id: categoryId };
}

/** Smaže kategorii — jen když v ní nejsou žádné profese (FK by to stejně odmítlo). */
export async function deleteCategory(
  actorUserId: string,
  categoryId: string,
): Promise<TaxonomyActionResult> {
  const professionCount = await db.profession.count({
    where: { categoryId },
  });
  if (professionCount > 0) {
    return { ok: false, error: "in_use", usageCount: professionCount };
  }

  await db.professionCategory.delete({ where: { id: categoryId } });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_category_deleted",
    targetType: "profession_category",
    targetId: categoryId,
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "category_deleted",
    targetId: categoryId,
  });
  return { ok: true, id: categoryId };
}

// --- Profese ------------------------------------------------------------------

export async function createProfession(
  actorUserId: string,
  input: ProfessionInput,
): Promise<TaxonomyActionResult> {
  const slug = await reserveUniqueSlug(input.name, async (candidate) => {
    const existing = await db.profession.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  const profession = await db.profession.create({
    data: {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      synonyms: input.synonyms,
      regulated: input.regulated,
      verificationHints: input.verificationHints,
      position: input.position,
    },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_profession_created",
    targetType: "profession",
    targetId: profession.id,
    metadata: { name: input.name },
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "profession_created",
    targetId: profession.id,
  });
  return { ok: true, id: profession.id };
}

export async function updateProfession(
  actorUserId: string,
  professionId: string,
  input: ProfessionInput,
): Promise<TaxonomyActionResult> {
  await db.profession.update({
    where: { id: professionId },
    data: {
      name: input.name,
      categoryId: input.categoryId,
      synonyms: input.synonyms,
      regulated: input.regulated,
      verificationHints: input.verificationHints,
      position: input.position,
    },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_profession_updated",
    targetType: "profession",
    targetId: professionId,
    metadata: { name: input.name },
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "profession_updated",
    targetId: professionId,
  });
  return { ok: true, id: professionId };
}

/** Deaktivuje profesi (T005: `active → archived`). Zmizí z výběrů, historie zůstává platná. */
export async function deactivateProfession(
  actorUserId: string,
  professionId: string,
): Promise<TaxonomyActionResult> {
  await db.profession.update({
    where: { id: professionId },
    data: { status: "archived" },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_profession_deactivated",
    targetType: "profession",
    targetId: professionId,
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "profession_deactivated",
    targetId: professionId,
  });
  return { ok: true, id: professionId };
}

export async function reactivateProfession(
  actorUserId: string,
  professionId: string,
): Promise<TaxonomyActionResult> {
  await db.profession.update({
    where: { id: professionId },
    data: { status: "active" },
  });
  await writeAuditLog({
    actorUserId,
    action: "taxonomy_profession_reactivated",
    targetType: "profession",
    targetId: professionId,
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "profession_reactivated",
    targetId: professionId,
  });
  return { ok: true, id: professionId };
}

/**
 * Smaže profesi — jen když ji nepoužívá žádný profil (T035 § Alternative
 * flows: pokus smazat používanou profesi → nabídnout deaktivaci). FK
 * `ProfileProfession.professionId` (`onDelete: Restrict`) by smazání stejně
 * odmítlo; tady to ověříme předem kvůli srozumitelné chybě s počtem referencí.
 */
export async function deleteProfession(
  actorUserId: string,
  professionId: string,
): Promise<TaxonomyActionResult> {
  const usageCount = await countProfessionUsage(professionId);
  if (usageCount > 0) {
    return { ok: false, error: "in_use", usageCount };
  }

  try {
    await db.profession.delete({ where: { id: professionId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return { ok: false, error: "in_use" };
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId,
    action: "taxonomy_profession_deactivated",
    targetType: "profession",
    targetId: professionId,
    metadata: { deleted: true },
  });
  trackEvent("admin_taxonomy_changed", {
    actorUserId,
    action: "profession_deleted",
    targetId: professionId,
  });
  return { ok: true, id: professionId };
}
