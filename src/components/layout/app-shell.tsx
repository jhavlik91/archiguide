"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

export type AppNavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export type AppShellUser = {
  name: string;
  email?: string;
  avatarUrl?: string;
};

export type AppShellProps = {
  /** Sidebar navigation entries. */
  navItems: AppNavItem[];
  /**
   * Overrides which nav item is highlighted as active. By default the shell
   * derives it from the current pathname.
   */
  activeHref?: string;
  /**
   * Context switcher slot rendered at the top of the sidebar. Empty in T006 —
   * filled by T004 (org/role context). Kept as a slot so this layout stays
   * feature-agnostic.
   */
  contextSwitcher?: React.ReactNode;
  /** Unread notification count shown on the bell. */
  notificationCount?: number;
  user?: AppShellUser;
  /**
   * Account controls rendered next to the avatar (e.g. a sign-out button).
   * Kept as a slot so the shell stays auth-agnostic (filled by T003).
   */
  accountMenu?: React.ReactNode;
  /** Label distinguishing the shell, e.g. "Admin". */
  areaLabel?: string;
  children: React.ReactNode;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** `/admin` matches `/admin` and `/admin/users`, but not `/admin-x`. */
function isActive(href: string, currentPath: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function SidebarNav({
  navItems,
  activeHref,
  onNavigate,
}: {
  navItems: AppNavItem[];
  activeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navigace aplikace" className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const active = isActive(item.href, activeHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Authenticated application shell: fixed sidebar on desktop, a slide-in drawer
 * on mobile, and a top bar with the notification bell and user avatar. Reused
 * by both the app and admin areas. Mobile-first — every control is reachable at
 * 360 px.
 */
function AppShell({
  navItems,
  activeHref,
  contextSwitcher,
  notificationCount = 0,
  user,
  accountMenu,
  areaLabel,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const currentHref = activeHref ?? pathname;
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const sidebarBody = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="ArchiGuide — domů">
          <Logo />
        </Link>
        {areaLabel ? (
          <Badge variant="secondary" className="shrink-0">
            {areaLabel}
          </Badge>
        ) : null}
      </div>
      {contextSwitcher ? <div>{contextSwitcher}</div> : null}
      <SidebarNav
        navItems={navItems}
        activeHref={currentHref}
        onNavigate={onNavigate}
      />
    </div>
  );

  return (
    <div className="bg-muted/30 flex min-h-dvh" data-area={areaLabel ?? "app"}>
      {/* Desktop sidebar */}
      <aside className="bg-background hidden w-64 shrink-0 border-r md:block">
        <div className="sticky top-0 h-dvh">{sidebarBody()}</div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigace"
            className="bg-background absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r shadow-xl"
          >
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zavřít navigaci"
                onClick={() => setDrawerOpen(false)}
              >
                <X />
              </Button>
            </div>
            {sidebarBody(() => setDrawerOpen(false))}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Otevřít navigaci"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </Button>

          <div className="min-w-0 flex-1">{contextSwitcher}</div>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              notificationCount > 0
                ? `Notifikace: ${notificationCount} nepřečtených`
                : "Notifikace"
            }
          >
            <Bell />
            {notificationCount > 0 ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            ) : null}
          </Button>

          {user ? (
            <Avatar className="size-9">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
          ) : null}

          {accountMenu}
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export { AppShell };
