"use client";

import Link from "next/link";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";

/**
 * Odkaz, který při kliknutí odešle analytickou událost (T034 § Analytics —
 * `search_result_clicked`). Payload nese jen ne-PII data (např. slug profilu).
 */
export function TrackedLink({
  href,
  event,
  payload,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  payload?: Record<string, unknown>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(event, payload)}
    >
      {children}
    </Link>
  );
}
