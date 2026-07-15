import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Kopie systémových rolí (e2e nezávisí na alias importu z `src`). */
type Role = "client" | "professional" | "moderator" | "admin";

/**
 * Přímý přístup do DB z e2e testů (T004) — jen pro přípravu stavu, který nelze
 * navodit přes UI (přidělení/odebrání role, jež v MVP dělá admin z T035).
 * `dotenv/config` načte DATABASE_URL z `.env` lokálně; v CI je v env jobu.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
export const db = new PrismaClient({ adapter });

export async function grantRoleByEmail(
  email: string,
  role: Role,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    create: { userId: user.id, role },
    update: {},
  });
}

export async function revokeRoleByEmail(
  email: string,
  role: Role,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.deleteMany({ where: { userId: user.id, role } });
}

// --- Messaging (T030) -------------------------------------------------------
// Konverzace se v MVP zakládají z domén (profil/poptávka), které ještě nemají
// UI vstupní bod. E2E proto seeduje konverzaci přímo do DB a testuje inbox,
// vlákno, odeslání a oprávnění přes reálné UI.

export async function getUserIdByEmail(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

/** Založí (nebo znovupoužije) 1:1 konverzaci mezi dvěma uživateli. Vrací ID. */
export async function seedConversation(
  userAId: string,
  userBId: string,
  context?: { type: string; id: string },
): Promise<string> {
  const sorted = [userAId, userBId].sort().join("~");
  const dedupeKey = `${context?.type ?? "direct"}:${context?.id ?? ""}:${sorted}`;
  const conv = await db.conversation.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      dedupeKey,
      contextType: context?.type ?? null,
      contextId: context?.id ?? null,
      participants: { create: [{ userId: userAId }, { userId: userBId }] },
    },
  });
  return conv.id;
}

/** Vloží zprávu do konverzace (seed historie pro čtecí testy). */
export async function seedMessage(
  conversationId: string,
  senderUserId: string,
  content: string,
): Promise<void> {
  await db.message.create({
    data: {
      conversationId,
      senderUserId,
      content,
      clientToken: `seed-${Date.now()}-${Math.random()}`,
    },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}

export async function deactivateUserByEmail(email: string): Promise<void> {
  await db.user.update({
    where: { email },
    data: { status: "deactivated" },
  });
}

// --- Notifikace (T032) ------------------------------------------------------
// Notifikace vznikají jako vedlejší efekt doménových akcí (emit z messagingu
// apod.); e2e je ověřuje přes reálné UI, ale pro přesná tvrzení (dedup počet,
// stav) čte i přímo z DB.

/** Notifikace příjemce (nejnovější událost nahoře) pro přesná tvrzení v e2e. */
export async function listNotificationsFor(
  recipientUserId: string,
): Promise<
  { title: string; dedupeKey: string; count: number; state: string }[]
> {
  return db.notification.findMany({
    where: { recipientUserId },
    orderBy: { lastEventAt: "desc" },
    select: { title: true, dedupeKey: true, count: true, state: true },
  });
}

/** ID nejnovější notifikace příjemce (pro test přístupu k cizí notifikaci). */
export async function getNotificationIdFor(
  recipientUserId: string,
): Promise<string | null> {
  const row = await db.notification.findFirst({
    where: { recipientUserId },
    orderBy: { lastEventAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

// --- Poptávka — viditelnost + anonymizace (T025) ----------------------------
// Pozvání konkrétního profesionála má UI vstupní bod až v T029 (matching);
// e2e proto pozvánku seeduje přímo do DB, stejný princip jako `seedConversation`.

/** Pozve profesionála k neveřejné poptávce (idempotentní). */
export async function seedRequestInvite(
  requestId: string,
  invitedUserId: string,
): Promise<void> {
  await db.requestInvite.upsert({
    where: { requestId_invitedUserId: { requestId, invitedUserId } },
    create: { requestId, invitedUserId },
    update: {},
  });
}
