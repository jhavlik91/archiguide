import { requireUser } from "@/lib/session";
import { getAllNotifications } from "@/features/notifications/queries";
import { NotificationsView } from "@/features/notifications/components/notifications-view";

/**
 * T032 — notifikační centrum (`/notifications`). Kompletní seznam notifikací
 * diváka; zvoneček v hlavičce ukazuje jen posledních pár. Klik na položku vede do
 * kontextu a označí ji přečtenou.
 */
export default async function NotificationsPage() {
  await requireUser();
  const { items, unreadCount } = await getAllNotifications();
  return <NotificationsView initial={items} initialUnread={unreadCount} />;
}
