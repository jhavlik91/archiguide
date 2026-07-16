import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Kopie systémových rolí (e2e nezávisí na alias importu z `src`). */
type Role = "client" | "professional" | "moderator" | "admin";

/** Kopie číselníků moderace (T036, e2e nezávisí na alias importu z `src`). */
type ReportTargetType =
  | "profile"
  | "portfolio_project"
  | "request"
  | "message"
  | "review"
  | "request_response";
type ReportReason =
  | "spam"
  | "scam"
  | "fake_identity"
  | "harassment"
  | "dangerous_advice"
  | "copyright"
  | "impersonation"
  | "illegal_solicitation"
  | "review_dispute";

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

// --- Messaging — přílohy / blokace / report (T031) --------------------------

/** ID nejnovější zprávy v konverzaci (pro ověření reportu / příloh). */
export async function latestMessageId(conversationId: string): Promise<string> {
  const msg = await db.message.findFirstOrThrow({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return msg.id;
}

/** ID první (aktivní i smazané) přílohy dané zprávy, nebo null. */
export async function attachmentIdForMessage(
  messageId: string,
): Promise<string | null> {
  const att = await db.attachment.findFirst({
    where: { contextType: "message", contextId: messageId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return att?.id ?? null;
}

/** Počet reportů dané zprávy (target type message). */
export async function reportCountForMessage(
  messageId: string,
): Promise<number> {
  return db.report.count({
    where: { targetType: "message", targetId: messageId },
  });
}

/** Existuje aktivní blokace blocker→blocked? */
export async function blockExists(
  blockerEmail: string,
  blockedEmail: string,
): Promise<boolean> {
  const [blocker, blocked] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: blockerEmail } }),
    db.user.findUniqueOrThrow({ where: { email: blockedEmail } }),
  ]);
  const row = await db.block.findUnique({
    where: {
      blockerUserId_blockedUserId: {
        blockerUserId: blocker.id,
        blockedUserId: blocked.id,
      },
    },
  });
  return row !== null;
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

// --- Poptávky — výpis + detail (T026) ---------------------------------------
// Filtr dle profese potřebuje víc poptávek s KONKRÉTNÍMI, rozdílnými profesemi
// — přes guide/brief by výsledná profese závisela na obsahu scénáře (křehké).
// Přímý seed už publikovaného řádku je stejný princip jako `seedConversation`
// výše: obchází UI vstupní bod, který pro tenhle konkrétní setup existuje, ale
// znamenal by zbytečně křehký a pomalý test.

/** Založí rovnou `active` + `public` poptávku (obchází guide/brief/publish UI). */
export async function seedPublishedRequest(params: {
  ownerUserId: string;
  title: string;
  professionSlugs: string[];
  region: string;
  budget?: string | null;
  visibility?: "public" | "private";
  status?: "active" | "paused";
}): Promise<string> {
  const row = await db.request.create({
    data: {
      ownerUserId: params.ownerUserId,
      title: params.title,
      type: "b2c",
      status: params.status ?? "active",
      visibility: params.visibility ?? "public",
      targetProfessionSlugs: params.professionSlugs,
      region: params.region,
      budget: params.budget ?? null,
      publishedAt: new Date(),
    },
  });
  return row.id;
}

// --- Matching UI (T029) ------------------------------------------------------
// Kandidátní karta potřebuje publikovaný profesionální profil (T007); přes
// onboarding wizard by test byl zbytečně pomalý a křehký (viz `publishProfile`
// helper v `professional-search.spec.ts`, který dělá přesně tohle přes UI, ale
// pro jediný, přesně zadaný profil je přímý seed spolehlivější — stejný princip
// jako `seedPublishedRequest` výše). Doporučení samotné seedujeme přímo —
// engine (T028) má vlastní unit testy; tenhle test cílí na UI nad hotovým
// doporučením, ne na přepočet.

/** Založí (nebo aktualizuje) publikovaný profesionální profil s danou profesí. */
export async function seedPublishedProfessionalProfile(params: {
  userId: string;
  slug: string;
  headline: string;
  professionSlug: string;
  location?: string;
}): Promise<void> {
  const profession = await db.profession.findUniqueOrThrow({
    where: { slug: params.professionSlug },
  });
  const profile = await db.professionalProfile.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      slug: params.slug,
      headline: params.headline,
      status: "published",
      publishedAt: new Date(),
      acceptingRequests: true,
      location: params.location ?? null,
    },
    update: {
      slug: params.slug,
      headline: params.headline,
      status: "published",
      publishedAt: new Date(),
      acceptingRequests: true,
      location: params.location ?? null,
    },
  });
  await db.profileProfession.upsert({
    where: {
      profileId_professionId: {
        profileId: profile.id,
        professionId: profession.id,
      },
    },
    create: {
      profileId: profile.id,
      professionId: profession.id,
      isPrimary: true,
    },
    update: { isPrimary: true },
  });
}

// --- Hodnocení (T037) --------------------------------------------------------
// Spor hodnoceného vzniká přes UI (viz reviews.spec.ts, hlavní flow); pro test
// moderační strany (fronta → náhled → hide) seedujeme rozporovanou recenzi
// přímo — celý řetěz recenzent→poptávka→accepted reakce→recenze→report by přes
// UI trval desítky kroků (stejný princip jako `seedConversation` výše).

/** Rozporovaná recenze profesionála + otevřený případ `review_dispute`. */
export async function seedDisputedReview(params: {
  targetUserId: string;
  text: string;
}): Promise<{ reviewId: string; reportId: string }> {
  const reviewer = await db.user.create({
    data: {
      email: `review-seed-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
    },
  });
  const request = await db.request.create({
    data: {
      ownerUserId: reviewer.id,
      title: "Seed poptávka pro recenzi",
      type: "b2c",
      status: "active",
      visibility: "public",
      targetProfessionSlugs: ["architekt"],
      region: "Praha",
      publishedAt: new Date(),
    },
  });
  const response = await db.requestResponse.create({
    data: {
      requestId: request.id,
      authorUserId: params.targetUserId,
      status: "accepted",
      message: "Seed reakce pro recenzi",
    },
  });
  const review = await db.review.create({
    data: {
      reviewerUserId: reviewer.id,
      targetUserId: params.targetUserId,
      evidenceResponseId: response.id,
      ratingCommunication: 1,
      ratingQuality: 2,
      ratingTimeliness: 1,
      ratingTransparency: 2,
      ratingProfessionalism: 1,
      text: params.text,
      status: "disputed",
      disputeReason: "Hodnocení neodpovídá průběhu zakázky.",
      disputedAt: new Date(),
    },
  });
  const reportId = await seedReport({
    targetType: "review",
    targetId: review.id,
    reporterUserId: params.targetUserId,
    reason: "review_dispute",
  });
  return { reviewId: review.id, reportId };
}

/** Založí doporučení přímo (bez volání matching enginu — testuje se jen UI). */
export async function seedMatchRecommendation(params: {
  requestId: string;
  candidateUserId: string;
  reasons: { type: string; detail: string }[];
}): Promise<string> {
  const row = await db.matchRecommendation.upsert({
    where: {
      requestId_candidateUserId: {
        requestId: params.requestId,
        candidateUserId: params.candidateUserId,
      },
    },
    create: {
      requestId: params.requestId,
      candidateUserId: params.candidateUserId,
      score: 10,
      reasons: params.reasons,
    },
    update: { reasons: params.reasons },
  });
  return row.id;
}
