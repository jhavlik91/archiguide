import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  Bell,
  FolderKanban,
  Images,
  User,
  Building2,
  Settings,
} from "lucide-react";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";
import { auth } from "@/auth";
import { requireUser } from "@/lib/session";
import { hasRole } from "@/lib/permissions";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { RoleContextSwitcher } from "@/features/roles/components/role-context-switcher";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getNotificationCentre } from "@/features/notifications/queries";

/**
 * Application navigation. The context switcher (T004) is shown only to accounts
 * that hold both the client and professional role. The notification bell (T032)
 * shows the live unread count and centre.
 */
const NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/dashboard", icon: <LayoutDashboard /> },
  { label: "Poptávky", href: "/requests", icon: <Inbox /> },
  { label: "Zprávy", href: "/messages", icon: <MessageSquare /> },
  { label: "Notifikace", href: "/notifications", icon: <Bell /> },
  { label: "Portfolio", href: "/portfolio", icon: <FolderKanban /> },
  { label: "Knihovna", href: "/media", icon: <Images /> },
  { label: "Profil", href: "/profile", icon: <User /> },
  { label: "Firmy", href: "/organizations", icon: <Building2 /> },
  { label: "Nastavení", href: "/settings", icon: <Settings /> },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Obrana do hloubky vedle middleware. `requireUser` čte role z DB per-request.
  const actor = await requireUser();
  const [session, notifications] = await Promise.all([
    auth(),
    getNotificationCentre(),
  ]);

  const email = session?.user?.email ?? "";
  // Přepínač jen pro účty s oběma rolemi (T004 § AC).
  const dualRole = hasRole(actor, "client") && hasRole(actor, "professional");

  return (
    <AppShell
      navItems={NAV_ITEMS}
      user={{ name: session?.user?.name ?? email, email }}
      accountMenu={<SignOutButton />}
      notificationSlot={<NotificationBell initial={notifications} />}
      contextSwitcher={
        dualRole ? (
          <RoleContextSwitcher active={actor.activeContext} />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
