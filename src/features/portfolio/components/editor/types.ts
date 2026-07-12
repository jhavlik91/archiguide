import type { PortfolioBlockKind } from "../../blocks";

/**
 * Blok, jak ho drží editor (T013). Oproti draftu ze serveru navíc nese lokální
 * `id` — stabilní klíč pro React, drag & drop a undo/redo v rámci session. Do
 * ukládání se posílá jen `{ type, content }` (server řádky přepíše a přiřadí
 * pořadí podle indexu).
 */
export type EditorBlock = {
  id: string;
  type: PortfolioBlockKind;
  content: Record<string, unknown>;
};

/** Vygeneruje lokální id nového bloku. */
export function newBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
