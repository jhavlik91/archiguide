/**
 * Veřejný vstupní bod notifikačního systému (T032). Domény (messaging, marketplace,
 * matching, verifikace, …) hlásí události VÝHRADNĚ přes `emit` z tohoto modulu a
 * NEPÍŠOU vlastní logiku doručování ani rozhodování o kanálech — stejně jako u
 * `@/lib/attachments`. Detaily (katalog, deduplikace, preference) žijí ve feature
 * `@/features/notifications`.
 */

export { emit } from "@/features/notifications/emit";
export type {
  EmitInput,
  EmitResult,
} from "@/features/notifications/emit";
export type { NotificationEventType } from "@/features/notifications/types";
