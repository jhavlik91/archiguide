import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  FolderKanban,
  User,
  Settings,
} from "lucide-react";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";

/**
 * Application navigation. The context switcher slot is intentionally left empty
 * here — T004 will supply the org/role switcher. The `user` and notification
 * count are placeholders until auth (T003) and notifications (T032) are wired.
 */
const NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/dashboard", icon: <LayoutDashboard /> },
  { label: "Poptávky", href: "/requests", icon: <Inbox /> },
  { label: "Zprávy", href: "/messages", icon: <MessageSquare /> },
  { label: "Portfolio", href: "/portfolio", icon: <FolderKanban /> },
  { label: "Profil", href: "/profile", icon: <User /> },
  { label: "Nastavení", href: "/settings", icon: <Settings /> },
];

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell
      navItems={NAV_ITEMS}
      user={{ name: "Anna Kučerová", email: "anna@example.com" }}
      notificationCount={3}
    >
      {children}
    </AppShell>
  );
}
