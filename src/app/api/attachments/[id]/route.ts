import { canAccess, getAttachment } from "@/lib/attachments";
import { getActor } from "@/lib/session";
import { getStorage } from "@/features/attachments/storage";
// Side-effect: registruje resolvery kontextů příloh (např. `message` z T031),
// aby `canAccess` uměla vyhodnotit účastnictví i v této route vrstvě.
import "@/lib/attachment-contexts";

/**
 * Autorizované stažení přílohy (T023 § Main flow bod 3). Soubory leží MIMO
 * `public/`, takže jediná cesta k nim vede přes tuto routu s kontrolou `canAccess`
 * — soukromá příloha není dostupná žádnou nepodepsanou URL. Nedostupné (bez
 * oprávnění / smazané / neexistující) → 404, aby se neprozradila existence cizí
 * soukromé přílohy.
 *
 * Servíruje se jako `attachment` (download), ne inline — příloha se nikdy
 * nevykresluje jako důvěryhodný obsah v kontextu appky.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const [actor, attachment] = await Promise.all([
    getActor(),
    getAttachment(id),
  ]);
  if (!attachment) return new Response(null, { status: 404 });

  const allowed = await canAccess(actor, {
    ownerUserId: attachment.ownerUserId,
    visibility: attachment.visibility,
    status: attachment.status,
    contextType: attachment.contextType,
    contextId: attachment.contextId,
  });
  if (!allowed) return new Response(null, { status: 404 });

  const data = await getStorage().get(attachment.storageKey);
  if (!data) return new Response(null, { status: 404 });

  // RFC 5987: bezpečné kódování názvu (diakritika) pro Content-Disposition.
  const encodedName = encodeURIComponent(attachment.fileName);

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      // Soukromý obsah — nikdy sdílená cache.
      "Cache-Control": "private, no-store",
    },
  });
}
