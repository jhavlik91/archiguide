import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type ConversationDetail,
  type ConversationSummary,
} from "../types";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";

/**
 * Responsivní two-pane layout messagingu (T030 § Main flow bod 7): na desktopu
 * seznam vlevo + vlákno vpravo, na mobilu se přepíná seznam ↔ vlákno podle toho,
 * zda je konverzace otevřená. Server komponenta — data přijdou z page.
 */
export function MessagesShell({
  conversations,
  active,
}: {
  conversations: ConversationSummary[];
  active: ConversationDetail | null;
}) {
  const activeId = active?.id ?? null;

  return (
    <div className="bg-background flex h-[calc(100dvh-6rem)] overflow-hidden rounded-lg border sm:h-[calc(100dvh-7rem)]">
      <aside
        className={cn(
          "w-full shrink-0 overflow-y-auto md:w-80 md:border-r",
          activeId ? "hidden md:block" : "block",
        )}
      >
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Zprávy</h1>
        </div>
        <ConversationList conversations={conversations} activeId={activeId} />
      </aside>

      <section
        aria-label="Vlákno konverzace"
        className={cn(
          "min-w-0 flex-1",
          activeId ? "flex" : "hidden md:flex",
        )}
      >
        {active ? (
          <MessageThread detail={active} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<MessageSquare />}
              title="Vyberte konverzaci"
              description="Zvolte konverzaci vlevo a zobrazte její vlákno."
            />
          </div>
        )}
      </section>
    </div>
  );
}
