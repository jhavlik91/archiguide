"use server";

import { trackEvent } from "@/lib/analytics";

/**
 * Server akce vyhledávání (T034). Existuje kvůli jediné věci: `trackEvent` je
 * serverová vrstva (strukturovaný log → později analytický sink), takže volání
 * z klienta by událost jen vypsalo do konzole prohlížeče a na server by nikdy
 * nedorazila. Klik na výsledek je ale klientská interakce — tahle akce ho tedy
 * překlopí zpátky na server.
 */

/**
 * Zaznamená klik na výsledek vyhledávání (§ Analytics — `search_result_clicked`).
 * Payload je záměrně jen slug profilu: žádné PII, žádný dotaz uživatele.
 */
export async function trackSearchResultClick(slug: string): Promise<void> {
  trackEvent("search_result_clicked", { slug });
}
