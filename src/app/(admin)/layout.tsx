import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Flag,
  BarChart3,
} from "lucide-react";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/session";
import { P_ACCESS_ADMIN_AREA } from "@/lib/permissions";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotificationCentre } from "@/features/notifications/queries";

const ADMIN_NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/admin", icon: <LayoutDashboard /> },
  { label: "Uživatelé", href: "/admin/users", icon: <Users /> },
  { label: "Moderace", href: "/admin/moderation", icon: <ShieldAlert /> },
  { label: "Nahlášení", href: "/admin/reports", icon: <Flag /> },
  { label: "Statistiky", href: "/admin/stats", icon: <BarChart3 /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Admin sekce: přihlášení řeší middleware, roli vynutí permission vrstva.
  // Nepřihlášený → /login, přihlášený bez role admin/moderator → 403 (T004).
  await requirePermission(P_ACCESS_ADMIN_AREA);
  const [session, notifications] = await Promise.all([
    auth(),
    getNotificationCentre(),
  ]);

  const email = session?.user?.email ?? "";
  return (
    <AppShell
      navItems={ADMIN_NAV_ITEMS}
      areaLabel="Admin"
      user={{ name: session?.user?.name ?? email, email }}
      accountMenu={<SignOutButton />}
      notificationSlot={<NotificationBell initial={notifications} />}
    >
      {children}
    </AppShell>
  );
}
