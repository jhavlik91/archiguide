import { resolveServableFile } from "@/features/media/queries";
import { getStorage } from "@/features/media/storage";
import { MEDIA_VARIANTS, type MediaVariant } from "@/features/media/types";
// Registruje oprávnění médií pro `can()` (side-effect import).
import "@/features/media/permissions";

/**
 * Servírování médií (T014). Soubory leží mimo `public/`, takže přístup vždy
 * projde touto routou s kontrolou oprávnění: originál dostane jen vlastník,
 * derivát i veřejnost — ale jen u assetu použitého v publikovaném obsahu
 * (`resolveServableFile` řeší celé rozhodnutí). Neexistující/nepovolené → 404
 * (existenci cizího soukromého assetu neprozrazujeme).
 */

export const runtime = "nodejs";

function isVariant(value: string): value is MediaVariant {
  return (MEDIA_VARIANTS as readonly string[]).includes(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> },
): Promise<Response> {
  const { id, variant } = await params;
  if (!isVariant(variant)) {
    return new Response(null, { status: 404 });
  }

  const servable = await resolveServableFile(id, variant);
  if (!servable) return new Response(null, { status: 404 });

  const data = await getStorage().get(servable.key);
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": servable.contentType,
      "Cache-Control": servable.cacheControl,
      "Content-Length": String(data.byteLength),
    },
  });
}
