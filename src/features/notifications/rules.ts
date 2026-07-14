/**
 * Čistá doménová pravidla notifikací (T032). Bez DB / `next/*`, aby šla plně
 * pokrýt unit testy a sdílet mezi emit API, čtecí vrstvou i UI.
 *
 * Těžiště: validace typu události proti katalogu, deterministický klíč
 * deduplikace a rozhodnutí o kanálech (default politika + preference uživatele).
 */

import {
  EVENT_CATALOG,
  type EventDefinition,
  type NotificationChannel,
  type NotificationPreferences,
} from "./types";

/** Je typ události v katalogu (`emit` neznámý typ zahodí, nikdy nespadne)? */
export function isKnownEvent(eventType: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENT_CATALOG, eventType);
}

/** Definice události z katalogu, nebo `null` pro neznámý typ. */
export function eventDefinition(eventType: string): EventDefinition | null {
  return isKnownEvent(eventType)
    ? EVENT_CATALOG[eventType as keyof typeof EVENT_CATALOG]
    : null;
}

/**
 * Deterministický klíč deduplikace. Volající ho může předat explicitně (např.
 * `new_message:<convId>`, aby 5 zpráv v konverzaci sloučilo do 1 notifikace);
 * jinak se odvodí z typu a kontextu. Bez kontextu je klíč jen typ události →
 * sloučí všechny nepřečtené téhož typu (bezpečné, konzervativní).
 */
export function buildDedupeKey(
  eventType: string,
  context: { type: string; id: string } | null | undefined,
  explicit?: string,
): string {
  if (explicit && explicit.trim().length > 0) return explicit.trim();
  if (context) return `${eventType}:${context.type}:${context.id}`;
  return eventType;
}

/**
 * Rozhodne efektivní kanály pro událost: začne default politikou z katalogu a
 * aplikuje uživatelské preference (per-událost má přednost před globálním
 * kanálem). Preference může kanál z defaultu VYPNOUT; zapnout podmíněný kanál nad
 * rámec defaultu smí jen explicitním `true`. Neznámý typ → žádné kanály.
 */
export function resolveChannels(
  eventType: string,
  prefs: NotificationPreferences | null | undefined,
): NotificationChannel[] {
  const def = eventDefinition(eventType);
  if (!def) return [];

  const globalPref = prefs?.channels ?? {};
  const eventPref = prefs?.events?.[eventType] ?? {};

  const enabled = new Set<NotificationChannel>();

  // Default kanály z politiky (mohou být preferencí vypnuty).
  for (const channel of def.channels) {
    const override = eventPref[channel] ?? globalPref[channel];
    if (override !== false) enabled.add(channel);
  }
  // Podmíněné kanály nad rámec defaultu jen při explicitním opt-inu.
  for (const channel of [
    ...Object.keys(globalPref),
    ...Object.keys(eventPref),
  ] as NotificationChannel[]) {
    const override = eventPref[channel] ?? globalPref[channel];
    if (override === true) enabled.add(channel);
  }

  return [...enabled];
}

/** Chce příjemce tuto událost v in-app kanálu (jediný materializovaný v MVP)? */
export function wantsInApp(
  eventType: string,
  prefs: NotificationPreferences | null | undefined,
): boolean {
  return resolveChannels(eventType, prefs).includes("in_app");
}

/** Vyšší z dvou priorit (dedup-bump může prioritu jen zvýšit, ne snížit). */
export function higherPriority<T extends string>(
  a: T,
  order: readonly T[],
  b: T,
): T {
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
