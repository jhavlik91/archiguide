import { NextResponse } from "next/server";
import {
  sanitizeFileName,
  validateUploadBytes,
} from "@/features/attachments/validation";
import {
  maxAttachmentBytes,
  tooLargeMessage,
  unsupportedTypeMessage,
} from "@/features/attachments/types";
import { performSend } from "@/features/messaging/send";
import { type PreparedAttachment } from "@/features/messaging/service";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MESSAGE_MAX_LENGTH,
} from "@/features/messaging/types";

/**
 * Odeslání zprávy S PŘÍLOHAMI (T031). Multipart route handler (ne server akce —
 * kvůli binárnímu payloadu), který sdílí jádro odeslání s textovou akcí přes
 * `performSend` (kontroly účastnictví, blokace, dostupnosti + atomické vložení).
 *
 * Přílohy se zvalidují PŘED založením zprávy (velikost + typ z obsahu). Když
 * kterákoli neprojde, nic se neuloží (text zůstává klientovi) — a samotné vložení
 * zprávy + příloh je atomické, takže nedoručitelná zpráva nezanechá osiřelou
 * přílohu (T031 § Acceptance).
 *
 * Pole formuláře: `conversationId`, `clientToken`, volitelně `content`,
 * `replyToId`, a 0..N souborů pod `files`.
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const conversationId = String(form.get("conversationId") ?? "").trim();
  const clientToken = String(form.get("clientToken") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const replyToIdRaw = String(form.get("replyToId") ?? "").trim();
  const replyToId = replyToIdRaw.length > 0 ? replyToIdRaw : undefined;

  if (!conversationId || !clientToken) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  if (content.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: "validation", message: `Zpráva je příliš dlouhá (max ${MESSAGE_MAX_LENGTH} znaků).` },
      { status: 400 },
    );
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return NextResponse.json(
      { error: "validation", message: `Najednou lze přiložit nejvýš ${MAX_ATTACHMENTS_PER_MESSAGE} souborů.` },
      { status: 400 },
    );
  }
  // Prázdná zpráva bez příloh nedává smysl (composer to hlídá i klientsky).
  if (content.length === 0 && files.length === 0) {
    return NextResponse.json(
      { error: "validation", message: "Zpráva nesmí být prázdná." },
      { status: 400 },
    );
  }

  // Validace VŠECH příloh předem — kterákoli chyba znamená „nic neukládáme".
  const prepared: PreparedAttachment[] = [];
  for (const file of files) {
    // Velikost zkontroluj z hlavičky DŘÍV, než soubor zhmotníš do paměti:
    // `validateUploadBytes` limit hlídá taky, ale to už by 10 × N GB leželo v
    // haldě. `file.size` je jen deklarace klienta, takže limit níž stejně platí —
    // tohle je jen levné odmítnutí zjevně přerostlého souboru.
    if (file.size > maxAttachmentBytes()) {
      return NextResponse.json(
        { error: "too_large", message: tooLargeMessage(file.name) },
        { status: 413 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBytes(bytes);
    if (!validation.ok) {
      const message =
        validation.error === "too_large"
          ? tooLargeMessage(file.name)
          : unsupportedTypeMessage(file.name);
      const status = validation.error === "too_large" ? 413 : 415;
      return NextResponse.json({ error: validation.error, message }, { status });
    }
    prepared.push({
      bytes,
      mime: validation.mime,
      fileName: sanitizeFileName(file.name, validation.mime),
    });
  }

  const result = await performSend({
    conversationId,
    content,
    clientToken,
    replyToId,
    attachments: prepared,
  });

  if (!result.ok) {
    const status =
      result.error === "unauthenticated"
        ? 401
        : result.error === "not_found"
          ? 404
          : result.error === "validation"
            ? 400
            : result.error === "blocked"
              ? 409
              : 500;
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status },
    );
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
