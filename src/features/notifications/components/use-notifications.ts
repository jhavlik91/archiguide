"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type NotificationView } from "../types";
import { markAllNotificationsRead } from "../actions";

/**
 * Sdílená klientská logika notifikačního centra (T032) pro zvoneček i stránku.
 * Drží lokální (optimistický) stav položek a počtu nepřečtených, který se
 * synchronizuje s čerstvými serverovými daty. Otevření jednotlivé notifikace řeší
 * server route `/notifications/[id]` (mark-read + přesměrování), takže tady stačí
 * hromadné „označit vše přečtené"; server je zdroj pravdy a `router.refresh()`
 * srovná layout (badge na zvonečku).
 */
export function useNotifications(
  initialItems: NotificationView[],
  initialUnread: number,
) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [, startTransition] = useTransition();

  // Nová serverová data (po revalidaci layoutu) přepíšou optimistický stav.
  useEffect(() => {
    setItems(initialItems);
    setUnreadCount(initialUnread);
  }, [initialItems, initialUnread]);

  /** Označí všechny nepřečtené jako přečtené (optimisticky) a potvrdí na serveru. */
  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return { items, unreadCount, markAll };
}
