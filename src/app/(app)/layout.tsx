import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  FolderKanban,
  User,
  Settings,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";
import { auth } from "@/auth";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * Application navigation. The context switcher slot is intentionally left empty
 * here — T004 will supply the org/role switcher. The notification count is a
 * placeholder until notifications (T032) are wired.
 */
const NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/dashboard", icon: <LayoutDashboard /> },
  { label: "Poptávky", href: "/requests", icon: <Inbox /> },
  { label: "Zprávy", href: "/messages", icon: <MessageSquare /> },
  { label: "Portfolio", href: "/portfolio", icon: <FolderKanban /> },
  { label: "Profil", href: "/profile", icon: <User /> },
  { label: "Nastavení", href: "/settings", icon: <Settings /> },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Obrana do hloubky vedle middleware; zároveň zdroj session uživatele.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email ?? "";
  return (
    <AppShell
      navItems={NAV_ITEMS}
      user={{ name: session.user.name ?? email, email }}
      accountMenu={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
