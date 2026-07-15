import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  dispatchDigestForUser,
  listDigestRecipientIds,
} from "@/features/notifications/digest-dispatch";
import type { DigestFrequency } from "@/features/notifications/digest";

/**
 * Cron endpoint pro periodický digest (T033 § Main flow bod 5). Volá ho
 * externí scheduler (denně / týdně dle nastaveného rozvrhu infrastruktury) —
 * tento endpoint sám neví, jaký den je, jen dostane `frequency` v query.
 * Autorizace sdíleným tajemstvím v hlavičce (žádná session — scheduler není
 * přihlášený uživatel), stejný princip jako webhooky.
 */

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Bez nakonfigurovaného tajemství endpoint nikdy nepustí.

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseFrequency(value: string | null): DigestFrequency | null {
  return value === "daily" || value === "weekly" ? value : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const frequency = parseFrequency(new URL(request.url).searchParams.get("frequency"));
  if (!frequency) {
    return NextResponse.json({ error: "invalid_frequency" }, { status: 400 });
  }

  const now = new Date();
  const recipientIds = await listDigestRecipientIds(frequency);

  const summary = { sent: 0, empty: 0, skipped: 0, already_sent: 0, failed: 0 };
  for (const userId of recipientIds) {
    const outcome = await dispatchDigestForUser(userId, frequency, now);
    summary[outcome] += 1;
  }

  return NextResponse.json({ frequency, candidates: recipientIds.length, ...summary });
}
