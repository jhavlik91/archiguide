"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  savePortfolioBlocks,
  type SavePortfolioBlocksResult,
} from "../../blocks-actions";
import type { DraftPortfolioBlock } from "../../blocks";

/**
 * Autosave draftových bloků (T013 § Main flow bod 3). Klíčové vlastnosti:
 *  - stav je vždy pravdivý: „uloženo" se ukáže až po potvrzeném zápisu; síťová
 *    chyba i chyba akce vedou na „chyba" a data zůstávají v editoru (retry),
 *  - debounce ~2 s, souběžné ukládání se neprolíná (drží se „saving" zámek),
 *  - změny během ukládání se nezahodí — po dokončení se uloží znovu.
 */

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

const DEBOUNCE_MS = 2000;
const RETRY_MS = 5000;

export type Autosave = {
  status: SaveStatus;
  /** Označí změnu; naplánuje uložení (debounce). */
  markDirty: () => void;
  /** Uloží okamžitě (tlačítko „Uložit teď" nebo před opuštěním). */
  saveNow: () => void;
};

export function useAutosave(
  projectId: string,
  /** Ref na aktuální bloky editoru — flush vždy pošle nejnovější stav. */
  blocksRef: React.RefObject<DraftPortfolioBlock[]>,
  initialVersion: number,
): Autosave {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const versionRef = useRef(initialVersion);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const flush = useCallback(async () => {
    clearTimer();
    if (savingRef.current) return; // doběhne aktuální zápis, pak se přeplánuje
    if (!dirtyRef.current) return;

    savingRef.current = true;
    dirtyRef.current = false;
    setStatus("saving");

    let result: SavePortfolioBlocksResult | null = null;
    try {
      result = await savePortfolioBlocks({
        projectId,
        baseVersion: versionRef.current,
        blocks: blocksRef.current,
      });
    } catch {
      result = null; // síťová / neočekávaná chyba
    }
    savingRef.current = false;

    if (result && result.ok) {
      versionRef.current = result.version;
      if (dirtyRef.current) {
        // Uživatel psal během ukládání — ulož znovu.
        setStatus("pending");
        timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
      } else {
        setStatus(result.conflict ? "conflict" : "saved");
      }
      return;
    }

    // Neúspěch: data si držíme, hlásíme chybu a zkusíme znovu.
    dirtyRef.current = true;
    setStatus("error");
    timerRef.current = setTimeout(() => void flush(), RETRY_MS);
  }, [projectId, blocksRef]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setStatus((prev) => (prev === "saving" ? prev : "pending"));
    clearTimer();
    timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  const saveNow = useCallback(() => {
    clearTimer();
    void flush();
  }, [flush]);

  // Úklid časovače při odmontování.
  useEffect(() => () => clearTimer(), []);

  return { status, markDirty, saveNow };
}
