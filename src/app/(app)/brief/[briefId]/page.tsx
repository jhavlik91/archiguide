import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getBriefById } from "@/features/brief/service";
import { canReadBrief } from "@/features/brief/permissions";
import { BriefPreview } from "@/features/brief/components/brief-preview";

/**
 * Náhled projektového briefu (`/brief/[briefId]`, T021). Vlastník-only: cizí/
 * neexistující brief vrací 404 (neprozradí existenci), chybějící oprávnění 403.
 * Vlastní render (sekce §18, CTA sloty) běží v klientském `BriefPreview`.
 */
export default async function BriefPage({
  params,
}: {
  params: Promise<{ briefId: string }>;
}) {
  const actor = await requireUser();
  const { briefId } = await params;

  const result = await getBriefById(briefId);
  if (!result.ok) notFound();
  if (!canReadBrief(actor, { ownerUserId: result.view.ownerUserId })) {
    // Cizí brief tváříme jako neexistující (neprozradíme, že patří někomu jinému).
    notFound();
  }

  return <BriefPreview brief={result.view} />;
}
