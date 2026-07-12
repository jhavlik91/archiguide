import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage adaptér příloh (T023). Fyzická data leží ZA jedním interfacem, aby dev
 * jel na filesystemu a prod na S3-kompatibilním úložišti bez změny volajícího kódu
 * (service vrstva zná jen `AttachmentStorage`). V DB držíme jen `storageKey`.
 *
 * Volba driveru: `ATTACHMENT_STORAGE_DRIVER` (`filesystem` výchozí | `s3`).
 * Filesystem ukládá do `ATTACHMENT_STORAGE_DIR` (výchozí `.storage/attachments`,
 * MIMO `public/`) — přístup se tak vždy řídí přes autorizovanou routu s kontrolou
 * `canAccess`, nikdy přímým veřejným odkazem (T023 § Main flow bod 3).
 */

export interface AttachmentStorage {
  /** Uloží data pod klíč. */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Načte data pod klíčem, nebo `null`, pokud neexistují. */
  get(key: string): Promise<Buffer | null>;
  /** Smaže data pod klíčem (idempotentní). */
  delete(key: string): Promise<void>;
}

// --- Filesystem adaptér (dev) -----------------------------------------------

class FilesystemStorage implements AttachmentStorage {
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
// Seam pro produkci: stejný interface, plní se z env. Reálná implementace
// (podepsané requesty / SDK) se doplní při nasazení; do té doby hlásí jasnou
// chybu místo tichého selhání, aby se omylem nespustil prod bez úložiště.

class UnconfiguredS3Storage implements AttachmentStorage {
  private fail(): never {
    throw new Error(
      "S3 storage driver zatím není nakonfigurován (ATTACHMENT_STORAGE_DRIVER=s3). " +
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

let instance: AttachmentStorage | undefined;

function build(): AttachmentStorage {
  const driver = process.env.ATTACHMENT_STORAGE_DRIVER ?? "filesystem";
  if (driver === "s3") return new UnconfiguredS3Storage();
  const dir =
    process.env.ATTACHMENT_STORAGE_DIR ??
    path.join(process.cwd(), ".storage", "attachments");
  return new FilesystemStorage(dir);
}

/** Sdílená instance storage adaptéru (dle env). */
export function getStorage(): AttachmentStorage {
  return (instance ??= build());
}

/** Jen pro testy: podvrhne storage adaptér (např. in-memory). */
export function __setStorageForTests(
  storage: AttachmentStorage | undefined,
): void {
  instance = storage;
}
