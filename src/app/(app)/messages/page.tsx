import { requireUser } from "@/lib/session";
import { getInbox } from "@/features/messaging/queries";
import { MessagesShell } from "@/features/messaging/components/messages-shell";

/**
 * T030 — inbox zpráv (`/messages`). Seznam konverzací; vlákno se otevře na
 * `/messages/[conversationId]`. Na desktopu se zobrazí prázdný pravý panel.
 */
export default async function MessagesPage() {
  await requireUser();
  const conversations = await getInbox();
  return <MessagesShell conversations={conversations} active={null} />;
}
