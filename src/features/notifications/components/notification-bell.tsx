"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { type NotificationCentre } from "../types";
import { useNotifications } from "./use-notifications";
import { NotificationRow } from "./notification-row";

/**
 * Notifikační zvoneček v hlavičce (T032 § Main flow bod 4). Ukazuje počet
 * nepřečtených a po rozbalení posledních N notifikací s důvodem a odkazem do
 * kontextu. Umožní označit jednotlivě (klik na položku) i vše najednou. Rozbalený
 * panel se zavře klávesou Escape nebo klikem mimo. Data přijdou ze serveru
 * (`getNotificationCentre`) a po akcích se srovnají přes `router.refresh()`.
 */
export function NotificationBell({ initial }: { initial: NotificationCentre }) {
  const { items, unreadCount, open, markAll } = useNotifications(
    initial.items,
    initial.unreadCount,
  );
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [expanded]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={
          unreadCount > 0
            ? `Notifikace: ${unreadCount} nepřečtených`
            : "Notifikace"
        }
        onClick={() => setExpanded((v) => !v)}
      >
        <Bell />
        {unreadCount > 0 ? (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {expanded ? (
        <div
          role="menu"
          aria-label="Notifikace"
          className="bg-popover text-popover-foreground absolute right-0 z-40 mt-2 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifikace</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
              >
                <CheckCheck className="size-3.5" />
                Označit vše přečtené
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Bell />}
                  title="Žádné notifikace"
                  description="Až se něco stane, dáme vám vědět tady."
                />
              </div>
            ) : (
              items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onOpen={(id) => {
                    open(id);
                    setExpanded(false);
                  }}
                />
              ))
            )}
          </div>

          <Link
            href="/notifications"
            prefetch={false}
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground border-t px-4 py-2.5 text-center text-xs"
          >
            Zobrazit vše
          </Link>
        </div>
      ) : null}
    </div>
  );
}
