/**
 * Veřejná fasáda attachment systému (T023) — JEDINÝ vstupní bod pro konzumující
 * domény (brief T022, poptávka T024, reakce T027, zprávy T031). Tyto tasky
 * NEPÍŠÍ vlastní přístupovou logiku: přiloží přes `attach`, ověří přístup přes
 * `canAccess` a svůj kontext zaregistrují přes `registerContextResolver`.
 *
 * Implementace žije v `@/features/attachments/*`; fasáda drží stabilní import
 * cestu a kurátorský výběr API (viz TECHNICKE-ZADANI.md §3 — sdílený kód přes
 * jasné rozhraní). Přístup se vždy rozhoduje přes permission vrstvu
 * (`lib/permissions.ts`), stažení vždy přes autorizovanou routu
 * `GET /api/attachments/[id]`.
 */

export {
  attach,
  canAccess,
  getAttachment,
  listContextViews,
  toView,
  type AttachInput,
  type AttachResult,
  type AccessTarget,
} from "@/features/attachments/access";

export {
  registerContextResolver,
  hasContextResolver,
  resolveContext,
  type ContextResolver,
  type ContextParticipation,
} from "@/features/attachments/registry";

export type { AttachmentContext } from "@/features/attachments/rules";

export {
  attachmentDownloadUrl,
  type AttachmentView,
  type AttachmentVisibility,
} from "@/features/attachments/types";
