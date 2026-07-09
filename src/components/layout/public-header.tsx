"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

export type NavLink = { label: string; href: string };

const DEFAULT_LINKS: NavLink[] = [
  { label: "Jak to funguje", href: "/#jak-to-funguje" },
  { label: "Pro architekty", href: "/#pro-architekty" },
  { label: "Ceník", href: "/#cenik" },
];

export type PublicHeaderProps = {
  links?: NavLink[];
};

/**
 * Public marketing header: wordmark, primary navigation and a login CTA.
 * Mobile-first — the nav collapses into a toggleable menu below `md`.
 */
function PublicHeader({ links = DEFAULT_LINKS }: PublicHeaderProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="ArchiGuide — domů">
          <Logo />
        </Link>

        <nav
          aria-label="Hlavní navigace"
          className="hidden items-center gap-6 md:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Přihlásit se</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Začít zdarma</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? "Zavřít menu" : "Otevřít menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      <div className={cn("border-t md:hidden", open ? "block" : "hidden")}>
        <nav
          aria-label="Hlavní navigace (mobil)"
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-2 py-2 text-sm font-medium transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Přihlásit se</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Začít zdarma</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

export { PublicHeader };
