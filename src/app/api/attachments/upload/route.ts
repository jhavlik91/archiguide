import { NextResponse } from "next/server";
import { attach, toView } from "@/lib/attachments";
import { contextSchema } from "@/features/attachments/validation";
import {
  tooLargeMessage,
  unsupportedTypeMessage,
} from "@/features/attachments/types";

/**
 * Upload přílohy (T023 § Main flow bod 2). Přímý multipart přes route handler
 * (ne server akce — kvůli binárnímu payloadu). `attach()` ověří přihlášení,
 * účastnictví v kontextu (resolver domény), typ z OBSAHU a velikost; záznam
 * vzniká až po uloženém souboru. Nová příloha je vždy `private`.
 *
 * Pole formuláře: `file`, `contextType`, `contextId`, volitelně `sensitive`
 * (`"true"`). Viditelnost se přes upload NEnastavuje — mění se vědomě až akcí
 * (T023 § Main flow bod 4).
 */

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const context = contextSchema.safeParse({
    contextType: form.get("contextType"),
    contextId: form.get("contextId"),
  });
  if (!context.success) {
    return NextResponse.json({ error: "invalid_context" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await attach(
    { type: context.data.contextType, id: context.data.contextId },
    {
      bytes,
      fileName: file.name,
      sensitive: form.get("sensitive") === "true",
    },
  );

  if (!result.ok) {
    switch (result.error) {
      case "unauthenticated":
        return NextResponse.json({ error: result.error }, { status: 401 });
      case "unknown_context":
      case "forbidden":
        // Neprozrazujeme, zda kontext existuje — jednotné 403.
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      case "too_large":
        return NextResponse.json(
          { error: result.error, message: tooLargeMessage(file.name) },
          { status: 413 },
        );
      case "unsupported_type":
        return NextResponse.json(
          { error: result.error, message: unsupportedTypeMessage(file.name) },
          { status: 415 },
        );
    }
  }

  return NextResponse.json(
    { attachment: toView(result.attachment) },
    { status: 201 },
  );
}
