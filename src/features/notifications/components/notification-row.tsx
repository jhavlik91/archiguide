"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { type NotificationView } from "../types";
import { formatRelative } from "./format";

/**
 * Jedna položka notifikačního centra (T032). Odkaz vede přímo do kontextu
 * (`href`) a klik ji zároveň označí přečtenou (`onOpen`) — necháváme nativní
 * navigaci (funguje i otevření v novém panelu; přečtení jen bez JS neproběhne).
 * Zobrazuje důvod (proč ji divák dostal) a případný počet sloučených událostí.
 */
export function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationView;
  onOpen: (id: string) => void;
}) {
  const n = notification;
  const urgent = n.priority === "urgent" || n.priority === "high";
  return (
    <Link
      href={n.href}
      prefetch={false}
      onClick={() => onOpen(n.id)}
      className={cn(
        "hover:bg-muted/50 flex gap-3 px-4 py-3 transition-colors",
        n.unread && "bg-primary/5",
      )}
    >
      {/* Tečka nepřečtené / místo pro zarovnání. */}
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          n.unread ? (urgent ? "bg-destructive" : "bg-primary") : "bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              n.unread ? "font-semibold" : "font-medium",
            )}
          >
            {n.title}
            {n.count > 1 ? (
              <span className="text-muted-foreground font-normal"> ×{n.count}</span>
            ) : null}
          </span>
          <time className="text-muted-foreground shrink-0 text-xs">
            {formatRelative(n.createdAt)}
          </time>
        </div>
        <p className="text-muted-foreground truncate text-xs">{n.reason}</p>
      </div>
      {n.unread ? <span className="sr-only">nepřečteno</span> : null}
    </Link>
  );
}
