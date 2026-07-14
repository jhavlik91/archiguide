import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getBriefById } from "@/features/brief/service";
import { canWriteBrief } from "@/features/brief/permissions";
import { BriefEditor } from "@/features/brief/components/brief-editor";

/**
 * Editace briefu (`/brief/[briefId]/upravit`, T022 § Main flow 1). Vlastník-only:
 * cizí/neexistující brief → 404 (neprozradíme existenci). Vlastní formulář
 * s autosavem běží v klientském `BriefEditor`.
 */
export default async function BriefEditPage({
  params,
}: {
  params: Promise<{ briefId: string }>;
}) {
  const actor = await requireUser();
  const { briefId } = await params;

  const result = await getBriefById(briefId);
  if (!result.ok) notFound();
  if (!canWriteBrief(actor, { ownerUserId: result.view.ownerUserId })) {
    notFound();
  }

  return <BriefEditor brief={result.view} />;
}
