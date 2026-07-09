import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Flag,
  BarChart3,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";
import { auth } from "@/auth";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

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
  // Admin sekce vyžaduje přihlášení; kontrolu rolí doplní T004.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email ?? "";
  return (
    <AppShell
      navItems={ADMIN_NAV_ITEMS}
      areaLabel="Admin"
      user={{ name: session.user.name ?? email, email }}
      accountMenu={<SignOutButton />}
    >
      {children}
    </AppShell>
  );
}
