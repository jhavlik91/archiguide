import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { resolveUploadOwner } from "@/features/media/queries";
import { createAssetFromUpload } from "@/features/media/service";
import { validateUploadBytes } from "@/features/media/validation";
import {
  MAX_BATCH_FILES,
  tooLargeMessage,
  unsupportedTypeMessage,
} from "@/features/media/types";
// Registruje oprávnění médií pro `can()` (side-effect import).
import "@/features/media/permissions";

/**
 * Upload médií (T014). Přímý multipart přes route handler (ne server akce — kvůli
 * binárnímu payloadu a dávce). Ověří oprávnění (vlastník / org editor+), pak per
 * soubor: velikost + typ z OBSAHU (magic bytes, ne přípona), generování derivátů
 * a uložení. Chyby jednotlivých souborů dávku neshodí — vrací se per soubor.
 *
 * Odpověď: `{ assets: [...], errors: [...] }`. `errors` drží srozumitelné hlášky
 * (příliš velký / nepodporovaný typ), aby je knihovna zobrazila u konkrétního
 * souboru.
 */

export const runtime = "nodejs";

type UploadedSummary = {
  id: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const ownerOrgId = (form.get("ownerOrgId") as string | null) || undefined;
  const resolved = await resolveUploadOwner(ownerOrgId);
  if (!resolved.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no_files" }, { status: 400 });
  }
  if (files.length > MAX_BATCH_FILES) {
    return NextResponse.json(
      {
        error: "too_many_files",
        message: `Najednou lze nahrát nejvýš ${MAX_BATCH_FILES} souborů.`,
      },
      { status: 400 },
    );
  }

  const assets: UploadedSummary[] = [];
  const errors: { name: string; message: string }[] = [];
  let uploadedBytes = 0;

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBytes(bytes);
    if (!validation.ok) {
      errors.push({
        name: file.name,
        message:
          validation.error === "too_large"
            ? tooLargeMessage(file.name)
            : unsupportedTypeMessage(file.name),
      });
      continue;
    }

    try {
      const asset = await createAssetFromUpload(
        resolved.owner,
        bytes,
        validation.mime,
      );
      uploadedBytes += bytes.byteLength;
      assets.push({
        id: asset.id,
        thumbnailUrl: `/api/media/${asset.id}/thumbnail`,
        width: asset.width,
        height: asset.height,
        altText: asset.altText,
      });
    } catch {
      // Poškozený/nečitelný obrázek projde sniffem, ale sharp ho odmítne.
      errors.push({
        name: file.name,
        message: `Soubor „${file.name}" se nepodařilo zpracovat.`,
      });
    }
  }

  if (assets.length > 0) {
    trackEvent("media.uploaded", {
      ownerType: resolved.owner.type,
      count: assets.length,
      bytes: uploadedBytes,
    });
  }

  return NextResponse.json({ assets, errors });
}
