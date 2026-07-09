import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Flag,
  BarChart3,
} from "lucide-react";
import { AppShell, type AppNavItem } from "@/components/layout/app-shell";

const ADMIN_NAV_ITEMS: AppNavItem[] = [
  { label: "Přehled", href: "/admin", icon: <LayoutDashboard /> },
  { label: "Uživatelé", href: "/admin/users", icon: <Users /> },
  { label: "Moderace", href: "/admin/moderation", icon: <ShieldAlert /> },
  { label: "Nahlášení", href: "/admin/reports", icon: <Flag /> },
  { label: "Statistiky", href: "/admin/stats", icon: <BarChart3 /> },
];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell
      navItems={ADMIN_NAV_ITEMS}
      areaLabel="Admin"
      user={{ name: "Admin", email: "admin@archiguide.cz" }}
    >
      {children}
    </AppShell>
  );
}
