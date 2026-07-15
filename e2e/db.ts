import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Kopie systémových rolí (e2e nezávisí na alias importu z `src`). */
type Role = "client" | "professional" | "moderator" | "admin";

/** Kopie číselníků moderace (T036, e2e nezávisí na alias importu z `src`). */
type ReportTargetType =
  "profile" | "portfolio_project" | "request" | "message" | "review";
type ReportReason =
  | "spam"
  | "scam"
  | "fake_identity"
  | "harassment"
  | "dangerous_advice"
  | "copyright"
  | "impersonation"
  | "illegal_solicitation";

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

// --- Moderace (T036) --------------------------------------------------------
// Nahlašovací UI vstupní bod přidávají až konzumující domény (T031 pro zprávy).
// E2E proto — stejně jako u konverzací výše — nahlášení seeduje přímo do DB a
// testuje frontu, detail, moderační akci a dopad (placeholder, notifikace) přes
// reálné admin UI.

/** Založí report na zadaný cíl s jedním nahlášením (simuluje "uživatel nahlásil"). */
export async function seedReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reporterUserId: string;
  reason?: ReportReason;
}): Promise<string> {
  const reason = params.reason ?? "harassment";
  const report = await db.report.create({
    data: {
      targetType: params.targetType,
      targetId: params.targetId,
      reason,
      submissions: {
        create: {
          reporterUserId: params.reporterUserId,
          reason,
        },
      },
    },
  });
  return report.id;
}

export async function getMessageModerationState(
  messageId: string,
): Promise<string> {
  const row = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  return row.moderationState;
}
