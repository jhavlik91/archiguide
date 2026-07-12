/**
 * Registr resolverů kontextu (T023). Attachment systém nezná konkrétní domény —
 * každá doména (brief, poptávka, reakce, zprávy) si při načtení svého modulu
 * zaregistruje resolver pro svůj `contextType`. Resolver odpovídá na dvě otázky:
 *  - existuje daný kontext?
 *  - je actor jeho účastníkem? (pro `shared_in_context` viditelnost i pro to,
 *    kdo smí do kontextu vůbec přikládat)
 *
 * Bez zaregistrovaného resolveru je kontext neznámý → fail-closed: přiložení se
 * odmítne a `shared_in_context` přístup se nikomu (kromě vlastníka) nepovolí.
 *
 * Modul je čistý (bez DB) — resolver dodává doména; jeho implementace může na DB
 * sahat. Držení resolverů v modulové mapě je HMR-safe (přeregistrace přepíše).
 */

import type { Actor } from "@/lib/permissions";
import type { AttachmentContext } from "./rules";

/** Odpověď resolveru o kontextu vůči konkrétnímu actorovi. */
export type ContextParticipation = {
  /** Existuje kontext (entita) v doméně? */
  exists: boolean;
  /** Je actor účastníkem kontextu (smí v něm vidět sdílené / přikládat)? */
  isParticipant: boolean;
};

/** Resolver kontextu registrovaný doménou. */
export type ContextResolver = (
  contextId: string,
  actor: Actor,
) => Promise<ContextParticipation>;

const resolvers = new Map<string, ContextResolver>();

/**
 * Zaregistruje resolver pro daný `contextType`. Volá doména při načtení svého
 * modulu (side-effect import). Opětovná registrace téhož typu resolver přepíše
 * (HMR-safe) — kolizi typů mezi doménami hlídá jmenná konvence `contextType`.
 */
export function registerContextResolver(
  contextType: string,
  resolver: ContextResolver,
): void {
  resolvers.set(contextType, resolver);
}

/** Je pro daný typ kontextu registrovaný resolver? */
export function hasContextResolver(contextType: string): boolean {
  return resolvers.has(contextType);
}

/**
 * Vyhodnotí kontext vůči actorovi. Neznámý typ (bez resolveru) → fail-closed
 * (`exists:false`), takže se do něj nepřikládá a nesdílí.
 */
export async function resolveContext(
  context: AttachmentContext,
  actor: Actor,
): Promise<ContextParticipation> {
  const resolver = resolvers.get(context.type);
  if (!resolver) return { exists: false, isParticipant: false };
  return resolver(context.id, actor);
}

/** Jen pro testy: vyprázdní registr resolverů. */
export function __resetResolversForTests(): void {
  resolvers.clear();
}
