import { forbidden } from "next/navigation";
import { getActor } from "@/lib/session";
import { can } from "@/lib/permissions";
import { P_ADMIN_MANAGE_TAXONOMY } from "@/features/admin/permissions";
import { listCategoriesForAdmin } from "@/features/admin/taxonomy/queries";
import {
  TaxonomyManager,
  type TaxonomyCategoryRow,
} from "@/features/admin/taxonomy/components/taxonomy-manager";

/** Správa taxonomie (T035 § Main flow 4) — jen admin, moderátor sem nemá přístup. */
export default async function AdminTaxonomyPage() {
  const actor = await getActor();
  if (!can(actor, P_ADMIN_MANAGE_TAXONOMY)) forbidden();

  const categories = await listCategoriesForAdmin();

  const rows: TaxonomyCategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    position: category.position,
    professions: category.professions.map((p) => ({
      id: p.id,
      name: p.name,
      synonyms: p.synonyms,
      regulated: p.regulated,
      verificationHints: p.verificationHints,
      status: p.status,
      position: p.position,
      usageCount: p._count.profileLinks,
    })),
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <TaxonomyManager categories={rows} />
    </div>
  );
}
