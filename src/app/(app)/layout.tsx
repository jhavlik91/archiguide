import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  FolderKanban,
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

/**
 * Application navigation. The context switcher (T004) is shown only to accounts
 * that hold both the client and professional role. The notification count is a
 * placeholder until notifications (T032) are wired.
 */
const NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/dashboard", icon: <LayoutDashboard /> },
  { label: "Poptávky", href: "/requests", icon: <Inbox /> },
  { label: "Zprávy", href: "/messages", icon: <MessageSquare /> },
  { label: "Portfolio", href: "/portfolio", icon: <FolderKanban /> },
  { label: "Profil", href: "/profile", icon: <User /> },
  { label: "Firmy", href: "/organizations", icon: <Building2 /> },
  { label: "Nastavení", href: "/settings", icon: <Settings /> },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Obrana do hloubky vedle middleware. `requireUser` čte role z DB per-request.
  const actor = await requireUser();
  const session = await auth();

  const email = session?.user?.email ?? "";
  // Přepínač jen pro účty s oběma rolemi (T004 § AC).
  const dualRole = hasRole(actor, "client") && hasRole(actor, "professional");

  return (
    <AppShell
      navItems={NAV_ITEMS}
      user={{ name: session?.user?.name ?? email, email }}
      accountMenu={<SignOutButton />}
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
