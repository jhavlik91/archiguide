"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
// Import zároveň registruje oprávnění administrace (admin.*).
import { canManageTaxonomy } from "../permissions";
import { findSimilarProfessions } from "./queries";
import {
  createCategory,
  createProfession,
  deactivateProfession,
  deleteCategory,
  deleteProfession,
  reactivateProfession,
  updateCategory,
  updateProfession,
} from "./service";
import { categorySchema, professionSchema } from "./validation";

/**
 * Server akce správy taxonomie (T035 § Main flow 4). Jen admin (moderátor sem
 * nemá přístup — na rozdíl od výpisu uživatelů). Duplicitní profese (§ Edge
 * cases) je jen VAROVÁNÍ, ne blok — admin ho musí explicitně potvrdit
 * (`confirmDuplicate`), aby šlo doplnit legitimní úzkou specializaci.
 */

export type TaxonomyFormResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthenticated" | "forbidden" | "validation" | "in_use";
      message: string;
    }
  | { ok: false; error: "duplicate_warning"; similar: string[] };

const UNAUTHENTICATED: TaxonomyFormResult = {
  ok: false,
  error: "unauthenticated",
  message: "Přihlaste se prosím.",
};
const FORBIDDEN: TaxonomyFormResult = {
  ok: false,
  error: "forbidden",
  message: "Na tuto akci nemáte oprávnění.",
};

function invalid(message = "Zkontrolujte zadané údaje."): TaxonomyFormResult {
  return { ok: false, error: "validation", message };
}

async function requireManager(): Promise<
  { actorUserId: string } | { result: TaxonomyFormResult }
> {
  const actor = await getActor();
  if (actor.kind !== "user") return { result: UNAUTHENTICATED };
  if (!canManageTaxonomy(actor)) return { result: FORBIDDEN };
  return { actorUserId: actor.userId };
}

function revalidateTaxonomy() {
  revalidatePath("/admin/taxonomy");
  // Veřejný výběr profesí (guide, profil, filtry) musí okamžitě odrážet změny.
  revalidatePath("/", "layout");
}

// --- Kategorie ----------------------------------------------------------------

export async function createCategoryAction(
  input: unknown,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  await createCategory(guard.actorUserId, parsed.data);
  revalidateTaxonomy();
  return { ok: true };
}

export async function updateCategoryAction(
  categoryId: string,
  input: unknown,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  await updateCategory(guard.actorUserId, categoryId, parsed.data);
  revalidateTaxonomy();
  return { ok: true };
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const result = await deleteCategory(guard.actorUserId, categoryId);
  if (!result.ok) {
    return {
      ok: false,
      error: "in_use",
      message: `Kategorie obsahuje ${result.usageCount ?? 0} profesí — přesuňte je jinam, nebo je nejdřív smažte.`,
    };
  }
  revalidateTaxonomy();
  return { ok: true };
}

// --- Profese --------------------------------------------------------------

export async function createProfessionAction(
  input: unknown,
  confirmDuplicate = false,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = professionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  if (!confirmDuplicate) {
    const similar = await findSimilarProfessions(parsed.data.name);
    if (similar.length > 0) {
      return {
        ok: false,
        error: "duplicate_warning",
        similar: similar.map((p) => p.name),
      };
    }
  }

  await createProfession(guard.actorUserId, parsed.data);
  revalidateTaxonomy();
  return { ok: true };
}

export async function updateProfessionAction(
  professionId: string,
  input: unknown,
  confirmDuplicate = false,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const parsed = professionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);

  if (!confirmDuplicate) {
    const similar = await findSimilarProfessions(parsed.data.name, professionId);
    if (similar.length > 0) {
      return {
        ok: false,
        error: "duplicate_warning",
        similar: similar.map((p) => p.name),
      };
    }
  }

  await updateProfession(guard.actorUserId, professionId, parsed.data);
  revalidateTaxonomy();
  return { ok: true };
}

export async function deactivateProfessionAction(
  professionId: string,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  await deactivateProfession(guard.actorUserId, professionId);
  revalidateTaxonomy();
  return { ok: true };
}

export async function reactivateProfessionAction(
  professionId: string,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  await reactivateProfession(guard.actorUserId, professionId);
  revalidateTaxonomy();
  return { ok: true };
}

export async function deleteProfessionAction(
  professionId: string,
): Promise<TaxonomyFormResult> {
  const guard = await requireManager();
  if ("result" in guard) return guard.result;

  const result = await deleteProfession(guard.actorUserId, professionId);
  if (!result.ok) {
    return {
      ok: false,
      error: "in_use",
      message: `Profesi používá ${result.usageCount ?? "existující"} profil(ů) — použijte deaktivaci místo smazání.`,
    };
  }
  revalidateTaxonomy();
  return { ok: true };
}
