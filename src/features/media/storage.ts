import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage adaptér médií (T014). Fyzická data (originál + deriváty) leží ZA jedním
 * interfacem, aby dev jel na filesystemu a prod na S3-kompatibilním úložišti bez
 * změny volajícího kódu (service vrstva zná jen `MediaStorage`). V DB držíme jen
 * klíče (`originalKey`, `thumbnailKey`, `webKey`), ne obsah.
 *
 * Volba driveru: `MEDIA_STORAGE_DRIVER` (`filesystem` výchozí | `s3`). Filesystem
 * ukládá do `MEDIA_STORAGE_DIR` (výchozí `.storage/media`, mimo `public/`, aby se
 * přístup vždy řídil přes serve route s kontrolou oprávnění).
 */

export interface MediaStorage {
  /** Uloží data pod klíč (přepíše, jen když volající klíč zvolí — originál nikdy). */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Načte data pod klíčem, nebo `null`, pokud neexistují. */
  get(key: string): Promise<Buffer | null>;
  /** Smaže data pod klíčem (idempotentní). */
  delete(key: string): Promise<void>;
}

// --- Filesystem adaptér (dev) -----------------------------------------------

class FilesystemStorage implements MediaStorage {
  constructor(private readonly rootDir: string) {}

  /** Klíč → absolutní cesta; brání path traversal (klíče generuje service vrstva). */
  private resolve(key: string): string {
    const target = path.resolve(this.rootDir, key);
    const root = path.resolve(this.rootDir);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Neplatný storage klíč: ${key}`);
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

// --- S3-kompatibilní adaptér (prod) -----------------------------------------
//
// Seam pro produkci: stejný interface, plní se z env (endpoint, bucket, klíče).
// Reálná implementace (podepsané requesty / SDK) se doplní při nasazení; do té
// doby hlásí jasnou chybu místo tichého selhání, aby se omylem nespustil prod
// bez nakonfigurovaného úložiště.

class UnconfiguredS3Storage implements MediaStorage {
  private fail(): never {
    throw new Error(
      "S3 storage driver zatím není nakonfigurován (MEDIA_STORAGE_DRIVER=s3). " +
        "Doplňte adaptér nebo přepněte na filesystem.",
    );
  }
  put(): Promise<void> {
    this.fail();
  }
  get(): Promise<Buffer | null> {
    this.fail();
  }
  delete(): Promise<void> {
    this.fail();
  }
}

// --- Factory ----------------------------------------------------------------

let instance: MediaStorage | undefined;

function build(): MediaStorage {
  const driver = process.env.MEDIA_STORAGE_DRIVER ?? "filesystem";
  if (driver === "s3") return new UnconfiguredS3Storage();
  const dir = process.env.MEDIA_STORAGE_DIR ?? path.join(process.cwd(), ".storage", "media");
  return new FilesystemStorage(dir);
}

/** Sdílená instance storage adaptéru (dle env). */
export function getStorage(): MediaStorage {
  return (instance ??= build());
}

/** Jen pro testy: podvrhne storage adaptér (např. in-memory). */
export function __setStorageForTests(storage: MediaStorage | undefined): void {
  instance = storage;
}

/** SHA-256 hash bajtů (dedup originálů). */
export function hashBytes(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
