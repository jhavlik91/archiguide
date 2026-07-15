import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "./types";

/**
 * Validace vstupů messagingu (T030 § Validation). Obsah zprávy musí být neprázdný
 * a v limitu délky; identifikátory neprázdné. `clientToken` je idempotenční klíč
 * odeslání z klienta (UUID) — chrání před duplicitou při double-clicku.
 */

const id = z.string().trim().min(1);

/** Neprázdný obsah zprávy v limitu délky (ořízne okrajové bílé znaky). */
const messageContent = z
  .string()
  .trim()
  .min(1, "Zpráva nesmí být prázdná.")
  .max(MESSAGE_MAX_LENGTH, `Zpráva je příliš dlouhá (max ${MESSAGE_MAX_LENGTH} znaků).`);

/** Idempotenční token odeslání — UUID vygenerovaný klientem pro každou zprávu. */
const clientToken = z.string().uuid("Neplatný identifikátor odeslání.");

/** Odeslání zprávy do existující konverzace. */
export const sendMessageSchema = z.object({
  conversationId: id,
  content: messageContent,
  clientToken,
  /** Volitelná odpověď na konkrétní zprávu (reply reference). */
  replyToId: id.optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Zahájení konverzace. Kontext je buď kompletní (typ + ID), nebo žádný (přímá
 * konverzace) — nikdy jen půlka. Úvodní zpráva je volitelná (konverzace z
 * kontextu může vzniknout prázdná); je-li vyplněná, musí projít validací obsahu.
 */
export const startConversationSchema = z
  .object({
    recipientUserId: id,
    contextType: id.optional(),
    contextId: id.optional(),
    content: messageContent.optional(),
    clientToken: clientToken.optional(),
  })
  .refine(
    (v) => (v.contextType === undefined) === (v.contextId === undefined),
    { message: "Kontext musí mít typ i ID, nebo žádné z nich.", path: ["contextId"] },
  );
export type StartConversationInput = z.infer<typeof startConversationSchema>;

/** Cíl akce nad konverzací (přečteno / archivace). */
export const conversationTargetSchema = z.object({ conversationId: id });

/** Nastavení archivace konverzace (per-účastník). */
export const archiveSchema = z.object({
  conversationId: id,
  archived: z.boolean(),
});

/** (Od)blokování protistrany konverzace (T031). `blocked: true` = zablokovat. */
export const blockSchema = z.object({
  conversationId: id,
  blocked: z.boolean(),
});

/** Odblokování konkrétního uživatele (ze seznamu v nastavení). */
export const unblockUserSchema = z.object({ blockedUserId: id });

/** Odstranění vlastní přílohy zprávy (T031 § Main flow bod 5). */
export const deleteAttachmentSchema = z.object({ attachmentId: id });
