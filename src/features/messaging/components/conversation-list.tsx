"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { type ConversationSummary } from "../types";
import { formatInboxTime, initials } from "./format";

/**
 * Seznam konverzací (inbox) — položky řazené podle poslední zprávy s náhledem,
 * časem a počítadlem nepřečtených (T030 § Main flow bod 4). Kliknutí otevře
 * vlákno; aktivní konverzace je zvýrazněná.
 */
export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
}) {
  if (conversations.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<MessageSquare />}
          title="Zatím žádné zprávy"
          description="Konverzace vzniknou z poptávek, reakcí nebo z profilu profesionála."
        />
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {conversations.map((c) => {
        const active = c.id === activeId;
        const unread = c.unreadCount > 0;
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "hover:bg-muted/50 flex gap-3 px-4 py-3 transition-colors",
                active && "bg-muted",
              )}
            >
              <Avatar className="size-10 shrink-0">
                <AvatarFallback>{initials(c.other.label)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm",
                      unread ? "font-semibold" : "font-medium",
                    )}
                  >
                    {c.other.label}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatInboxTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      unread ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.lastMessagePreview ?? "Zatím bez zpráv"}
                  </p>
                  {unread ? (
                    <Badge className="shrink-0" aria-label={`${c.unreadCount} nepřečtených`}>
                      {c.unreadCount}
                    </Badge>
                  ) : null}
                </div>
                {c.context ? (
                  <span className="text-muted-foreground mt-1 inline-block text-xs">
                    {c.context.label}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
