import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getConversationDetail, getInbox } from "@/features/messaging/queries";
import { MessagesShell } from "@/features/messaging/components/messages-shell";

/**
 * T030 — vlákno konverzace (`/messages/[conversationId]`). Načte detail (jinak
 * 404, aby neprozradil cizí konverzaci) i seznam pro levý panel. Označení
 * přečtení a polling řeší klientské vlákno.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  await requireUser();
  const { conversationId } = await params;

  const [conversations, detail] = await Promise.all([
    getInbox(),
    getConversationDetail(conversationId),
  ]);
  if (!detail) notFound();

  return <MessagesShell conversations={conversations} active={detail} />;
}
