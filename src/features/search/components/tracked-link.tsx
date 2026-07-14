"use client";

import Link from "next/link";
import { trackSearchResultClick } from "../actions";

/**
 * Odkaz na výsledek vyhledávání, který klik zaznamená do analytiky (T034 §
 * Analytics — `search_result_clicked`). Payload nese jen slug profilu (ne-PII).
 *
 * Událost jde přes SERVER AKCI, ne přímým `trackEvent`: analytika je serverová
 * vrstva (log → později sink), takže volání z klienta by událost vypsalo jen do
 * konzole prohlížeče a na server by nedorazila. Odeslání je best-effort a
 * navigaci nikdy neblokuje — nezaznamenaný klik není důvod rozbít proklik.
 */
export function TrackedLink({
  href,
  slug,
  className,
  children,
}: {
  href: string;
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => void trackSearchResultClick(slug).catch(() => {})}
    >
      {children}
    </Link>
  );
}
