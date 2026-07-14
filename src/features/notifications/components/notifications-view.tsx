"use client";

import { Bell, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { type NotificationView } from "../types";
import { useNotifications } from "./use-notifications";
import { NotificationRow } from "./notification-row";

/**
 * Plná stránka notifikačního centra (`/notifications`, T032). Seznam všech
 * notifikací diváka s možností označit jednotlivě (klik) i vše najednou. Sdílí
 * logiku i řádky se zvonečkem.
 */
export function NotificationsView({
  initial,
  initialUnread,
}: {
  initial: NotificationView[];
  /** Skutečný počet nepřečtených (ne odvozený z limitovaného seznamu). */
  initialUnread: number;
}) {
  const { items, unreadCount, markAll } = useNotifications(initial, initialUnread);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notifikace</h1>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck className="size-4" />
            Označit vše přečtené
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="Žádné notifikace"
          description="Až se něco stane — nová zpráva, reakce na poptávku nebo výsledek verifikace — najdete to tady."
        />
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationRow notification={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
