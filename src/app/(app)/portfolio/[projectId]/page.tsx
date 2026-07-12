import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getEditableProject } from "@/features/portfolio/queries";
import { listDraftBlocks } from "@/features/portfolio/blocks-service";
import { listMyMedia } from "@/features/media/queries";
import { BlockEditor } from "@/features/portfolio/components/editor/block-editor";
import { MetadataForm } from "@/features/portfolio/components/editor/metadata-form";
import {
  newBlockId,
  type EditorBlock,
} from "@/features/portfolio/components/editor/types";
import type { MediaCardData } from "@/features/media/components/media-library";

/**
 * T013 — blokový editor portfolia (`/portfolio/[projectId]`). Načte editovatelné
 * dílo (jinak 404, aby neprozradil cizí draft), jeho draftové bloky + verzi a
 * osobní knihovnu médií pro výběr obrázků. Vlastní editace (autosave, undo/redo,
 * náhled) běží v klientském `BlockEditor`.
 */
export default async function PortfolioEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireUser();
  const { projectId } = await params;

  const editable = await getEditableProject(projectId);
  if (!editable) notFound();
  const project = editable.project;

  const [{ blocks, version }, assets] = await Promise.all([
    listDraftBlocks(projectId),
    listMyMedia(),
  ]);

  // Lokální id přidělíme na serveru a předáme jako props → klient dostane stejná
  // (žádný hydration mismatch), zároveň slouží jako stabilní React klíče.
  const editorBlocks: EditorBlock[] = blocks.map((block) => ({
    id: newBlockId(),
    type: block.type,
    content: (block.content ?? {}) as Record<string, unknown>,
  }));

  const cards: MediaCardData[] = assets.map((asset) => ({
    id: asset.id,
    thumbnailUrl: `/api/media/${asset.id}/thumbnail`,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MetadataForm
        project={{
          id: project.id,
          title: project.title,
          projectType: project.projectType,
          location: project.location,
          year: project.year,
          description: project.description,
          visibility: project.visibility,
          status: project.status,
        }}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Obsah</h2>
        <BlockEditor
          projectId={project.id}
          initialBlocks={editorBlocks}
          initialVersion={version}
          initialAssets={cards}
        />
      </section>
    </div>
  );
}
