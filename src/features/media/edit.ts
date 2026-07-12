/**
 * Úpravy obrázků (T015) — čistá doménová vrstva. Bez DB / `next/*` / `sharp`, aby
 * šla sdílet mezi editorem (klient), akcemi i render pipeline (server) a pokrýt
 * unit testy.
 *
 * Model verzí: úprava je popsaná parametry (`ImageEdit`) vztaženými k ORIGINÁLU.
 * Aktivní verze je jedna; deriváty se vždy renderují z originálu (ne z předchozího
 * derivátu), takže opakovaná úprava kvalitu nedegraduje (T015 § Edge cases).
 * „Vrátit originál" = zahodit parametry.
 *
 * Základní sada (T015 / `zadani/legacy-master-spec.md` §25.3): crop s presety
 * poměru stran, rotace po 90°, jas, kontrast, saturace. Crop je centrovaný výřez
 * zvoleného poměru (volný free-form výřez je mimo rozsah „základní" sady).
 */

/** Poměry stran pro crop. `free` = bez cropu (zachová poměr originálu). */
export const CROP_PRESETS = ["free", "1:1", "4:3", "16:9"] as const;
export type CropPreset = (typeof CROP_PRESETS)[number];

/** Rotace po 90° (ve směru hodinových ručiček). */
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

/** Bezpečné meze jasu a kontrastu (multiplikátor kolem neutrální 1). */
export const ADJUST_MIN = 0.5;
export const ADJUST_MAX = 1.5;
/** Bezpečné meze saturace (0 = odbarveno, 1 = neutrální, 2 = dvojnásobek). */
export const SATURATION_MIN = 0;
export const SATURATION_MAX = 2;

/** Minimální strana výřezu v px (T015 § Validation). */
export const MIN_CROP_PX = 50;

/** Parametry jedné úpravy, vztažené k originálu. */
export type ImageEdit = {
  rotate: Rotation;
  crop: CropPreset;
  /** Jas: multiplikátor v <ADJUST_MIN, ADJUST_MAX>, 1 = beze změny. */
  brightness: number;
  /** Kontrast: multiplikátor v <ADJUST_MIN, ADJUST_MAX>, 1 = beze změny. */
  contrast: number;
  /** Saturace: v <SATURATION_MIN, SATURATION_MAX>, 1 = beze změny. */
  saturation: number;
};

/** Neutrální úprava = originál (žádná změna). */
export const NEUTRAL_EDIT: ImageEdit = {
  rotate: 0,
  crop: "free",
  brightness: 1,
  contrast: 1,
  saturation: 1,
};

/** Je úprava neutrální (rovná se originálu)? Pak se ukládá jako „vrátit originál". */
export function isNeutralEdit(edit: ImageEdit): boolean {
  return (
    edit.rotate === 0 &&
    edit.crop === "free" &&
    edit.brightness === 1 &&
    edit.contrast === 1 &&
    edit.saturation === 1
  );
}

/** Ořízne hodnotu do <min, max>. NaN → `min`. */
export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Číslo v mezích, ale neplatný (nečíselný) vstup spadne na neutrální default. */
function adjust(value: unknown, min: number, max: number): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) ? clampNumber(n, min, max) : 1;
}

/**
 * Normalizuje libovolný (i klientský) vstup na platný `ImageEdit`: neznámé hodnoty
 * spadnou na neutrální, čísla se ořežou do bezpečných mezí. Jediné místo, kde se
 * z „čehokoli" stane bezpečná úprava — používá ji akce i deserializace `editParams`.
 */
export function normalizeEdit(input: unknown): ImageEdit {
  const raw = (input ?? {}) as Partial<Record<keyof ImageEdit, unknown>>;
  const rotate = (ROTATIONS as readonly number[]).includes(raw.rotate as number)
    ? (raw.rotate as Rotation)
    : 0;
  const crop = (CROP_PRESETS as readonly string[]).includes(raw.crop as string)
    ? (raw.crop as CropPreset)
    : "free";
  return {
    rotate,
    crop,
    brightness: adjust(raw.brightness, ADJUST_MIN, ADJUST_MAX),
    contrast: adjust(raw.contrast, ADJUST_MIN, ADJUST_MAX),
    saturation: adjust(raw.saturation, SATURATION_MIN, SATURATION_MAX),
  };
}

/** Poměr stran presetu jako [šířka, výška], nebo `null` pro `free`. */
export function aspectRatio(preset: CropPreset): [number, number] | null {
  switch (preset) {
    case "1:1":
      return [1, 1];
    case "4:3":
      return [4, 3];
    case "16:9":
      return [16, 9];
    default:
      return null;
  }
}

export type CropRect = { left: number; top: number; width: number; height: number };

/**
 * Největší centrovaný výřez daného poměru uvnitř `w × h` (v px). Zaokrouhluje na
 * celé pixely a drží výřez uvnitř plátna.
 */
export function centeredAspectCrop(w: number, h: number, ratioW: number, ratioH: number): CropRect {
  const targetRatio = ratioW / ratioH;
  const sourceRatio = w / h;
  let cw: number;
  let ch: number;
  if (sourceRatio > targetRatio) {
    // Zdroj je širší → limituje výška.
    ch = h;
    cw = Math.round(h * targetRatio);
  } else {
    // Zdroj je vyšší/stejný → limituje šířka.
    cw = w;
    ch = Math.round(w / targetRatio);
  }
  cw = Math.min(cw, w);
  ch = Math.min(ch, h);
  const left = Math.floor((w - cw) / 2);
  const top = Math.floor((h - ch) / 2);
  return { left, top, width: cw, height: ch };
}

/** Rozměry po rotaci po 90° (90/270 prohodí strany). */
export function rotatedDimensions(w: number, h: number, rotate: Rotation): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: h, height: w } : { width: w, height: h };
}

/**
 * Rozměry výsledné (upravené) verze z rozměrů originálu a parametrů — pro uložení
 * `editedWidth`/`editedHeight` a pro poměr stran v UI. Nejdřív rotace, pak crop.
 */
export function editedDimensions(originalW: number, originalH: number, edit: ImageEdit): { width: number; height: number } {
  const rotated = rotatedDimensions(originalW, originalH, edit.rotate);
  const ratio = aspectRatio(edit.crop);
  if (!ratio) return rotated;
  const crop = centeredAspectCrop(rotated.width, rotated.height, ratio[0], ratio[1]);
  return { width: crop.width, height: crop.height };
}

export type CropCheck = { ok: true } | { ok: false; message: string };

/**
 * Ověří, že by výsledný výřez nebyl menší než `MIN_CROP_PX` v žádné straně
 * (T015 § Validation). Pro `free` (bez cropu) vždy projde.
 */
export function checkCrop(originalW: number, originalH: number, edit: ImageEdit): CropCheck {
  if (edit.crop === "free") return { ok: true };
  const { width, height } = editedDimensions(originalW, originalH, edit);
  if (width < MIN_CROP_PX || height < MIN_CROP_PX) {
    return {
      ok: false,
      message: `Výřez by byl menší než ${MIN_CROP_PX}×${MIN_CROP_PX} px. Zvolte jiný poměr stran.`,
    };
  }
  return { ok: true };
}
