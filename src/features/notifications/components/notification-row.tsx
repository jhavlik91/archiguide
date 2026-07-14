"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { type NotificationView } from "../types";
import { formatRelative } from "./format";

/**
 * Jedna položka notifikačního centra (T032). Odkazuje na server route
 * `/notifications/[id]`, která notifikaci označí přečtenou a přesměruje do
 * kontextu (`linkPath`) — jednou navigací, bez klientské akce závodící s
 * přesměrováním (to dřív přerušovalo request a shazovalo dev server).
 * `prefetch={false}` je nutné: prefetch odkazu by mark-read spustil předčasně.
 * Zobrazuje důvod (proč ji divák dostal) a počet sloučených událostí.
 */
export function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: NotificationView;
  onNavigate?: () => void;
}) {
  const n = notification;
  const urgent = n.priority === "urgent" || n.priority === "high";
  return (
    <Link
      href={`/notifications/${n.id}`}
      prefetch={false}
      onClick={onNavigate}
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
            {formatRelative(n.lastEventAt)}
          </time>
        </div>
        <p className="text-muted-foreground truncate text-xs">{n.reason}</p>
      </div>
      {n.unread ? <span className="sr-only">nepřečteno</span> : null}
    </Link>
  );
}
