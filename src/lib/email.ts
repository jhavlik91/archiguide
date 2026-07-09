/**
 * Normalizace e-mailu na kanonickou podobu (trim + lowercase) používanou při
 * zápisu uživatelů. Databáze navíc vynucuje case-insensitive unikátnost přes
 * typ `citext`, takže „Foo@x.cz“ a „foo@x.cz“ nikdy nekoexistují.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Dva e-maily jsou pro účely unikátnosti považovány za shodné, pokud se jejich
 * normalizované podoby rovnají (odpovídá chování `citext` unikátního indexu).
 */
export function emailsCollide(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}
