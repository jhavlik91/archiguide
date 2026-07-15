/**
 * Čistá doménová pravidla notifikací (T032). Bez DB / `next/*`, aby šla plně
 * pokrýt unit testy a sdílet mezi emit API, čtecí vrstvou i UI.
 *
 * Těžiště: validace typu události proti katalogu, deterministický klíč
 * deduplikace a rozhodnutí o kanálech (default politika + preference uživatele).
 */

import {
  EVENT_CATALOG,
  type EmailFrequency,
  type EventDefinition,
  type NotificationChannel,
  type NotificationGroup,
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

/** Skupina typu události z katalogu, nebo `null` pro neznámý typ. */
export function eventGroup(eventType: string): NotificationGroup | null {
  return eventDefinition(eventType)?.group ?? null;
}

/**
 * Sjednocení default kanálů přes VŠECHNY události dané skupiny — použije
 * preferenční UI (T033) jako výchozí stav zaškrtávátek, dokud uživatel nic
 * neuloží. Skupina obsahuje událost s e-mailem v politice (např. `new_response`
 * v `marketplace`) → checkbox e-mailu je defaultně zapnutý, i když jiná událost
 * stejné skupiny (`response_viewed`) e-mail v defaultu nemá. Bez toho by
 * needitovaný formulář po prvním uložení tiše zapnul e-mail i tam, kde ho
 * politika vůbec nenabízí (např. `messaging` — e-mail je tam jen opt-in).
 */
export function groupDefaultChannels(
  group: NotificationGroup,
): NotificationChannel[] {
  const channels = new Set<NotificationChannel>();
  for (const def of Object.values(EVENT_CATALOG) as EventDefinition[]) {
    if (def.group === group) {
      for (const channel of def.channels) channels.add(channel);
    }
  }
  return [...channels];
}

/**
 * Rozhodne efektivní kanály pro událost: začne default politikou z katalogu a
 * aplikuje uživatelské preference v pořadí rostoucí specificity — globální kanál
 * → skupina (T033 preferenční matice) → per-událost (nejvyšší přednost).
 * Preference může kanál z defaultu VYPNOUT; zapnout podmíněný kanál nad rámec
 * defaultu smí jen explicitním `true`. Kritická servisní událost (`critical`)
 * má in-app vždy zapnutý bez ohledu na preferenci (T033 § Main flow bod 3).
 * Neznámý typ → žádné kanály.
 */
export function resolveChannels(
  eventType: string,
  prefs: NotificationPreferences | null | undefined,
): NotificationChannel[] {
  const def = eventDefinition(eventType);
  if (!def) return [];

  const globalPref = prefs?.channels ?? {};
  const groupPref = prefs?.groups?.[def.group] ?? {};
  const eventPref = prefs?.events?.[eventType] ?? {};

  function effective(channel: NotificationChannel): boolean | undefined {
    if (eventPref[channel] !== undefined) return eventPref[channel];
    if (groupPref[channel] !== undefined) return groupPref[channel];
    return globalPref[channel];
  }

  const enabled = new Set<NotificationChannel>();

  // Default kanály z politiky (mohou být preferencí vypnuty).
  for (const channel of def.channels) {
    if (effective(channel) !== false) enabled.add(channel);
  }
  // Podmíněné kanály nad rámec defaultu jen při explicitním opt-inu.
  for (const channel of [
    ...Object.keys(globalPref),
    ...Object.keys(groupPref),
    ...Object.keys(eventPref),
  ] as NotificationChannel[]) {
    if (effective(channel) === true) enabled.add(channel);
  }

  if (def.critical) enabled.add("in_app");

  return [...enabled];
}

/** Chce příjemce tuto událost v in-app kanálu (jediný materializovaný v MVP)? */
export function wantsInApp(
  eventType: string,
  prefs: NotificationPreferences | null | undefined,
): boolean {
  return resolveChannels(eventType, prefs).includes("in_app");
}

/** Chce příjemce tuto událost e-mailem (respektuje preference, ne frekvenci)? */
export function wantsEmail(
  eventType: string,
  prefs: NotificationPreferences | null | undefined,
): boolean {
  return resolveChannels(eventType, prefs).includes("email");
}

/** Frekvence e-mailového kanálu; chybí-li preference, defaultně `"immediate"`. */
export function emailFrequency(
  prefs: NotificationPreferences | null | undefined,
): EmailFrequency {
  return prefs?.emailFrequency ?? "immediate";
}

/** Vyšší z dvou priorit (dedup-bump může prioritu jen zvýšit, ne snížit). */
export function higherPriority<T extends string>(
  a: T,
  order: readonly T[],
  b: T,
): T {
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
