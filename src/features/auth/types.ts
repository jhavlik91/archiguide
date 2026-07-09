/** Sjednocený výsledek auth server actions pro použití v UI (useActionState). */
export type AuthActionResult =
  | { ok: true; redirectTo?: string }
  | {
      ok: false;
      /** Strojově čitelný kód chyby (např. "invalid", "deactivated"). */
      error: string;
      /** Uživatelská zpráva k zobrazení. */
      message: string;
    };
