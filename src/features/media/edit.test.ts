import { describe, expect, it } from "vitest";
import {
  ADJUST_MAX,
  ADJUST_MIN,
  centeredAspectCrop,
  checkCrop,
  editedDimensions,
  isNeutralEdit,
  MIN_CROP_PX,
  NEUTRAL_EDIT,
  normalizeEdit,
  rotatedDimensions,
  type ImageEdit,
} from "./edit";

describe("normalizeEdit", () => {
  it("prázdný/neznámý vstup → neutrální úprava", () => {
    expect(normalizeEdit(undefined)).toEqual(NEUTRAL_EDIT);
    expect(normalizeEdit({ rotate: 45, crop: "5:4", brightness: "x" })).toEqual(
      NEUTRAL_EDIT,
    );
  });

  it("čísla ořízne do bezpečných mezí", () => {
    const edit = normalizeEdit({ brightness: 99, contrast: -5, saturation: 99 });
    expect(edit.brightness).toBe(ADJUST_MAX);
    expect(edit.contrast).toBe(ADJUST_MIN);
    expect(edit.saturation).toBe(2);
  });

  it("platné hodnoty projdou beze změny", () => {
    const input: ImageEdit = {
      rotate: 90,
      crop: "16:9",
      brightness: 1.2,
      contrast: 0.9,
      saturation: 1.5,
    };
    expect(normalizeEdit(input)).toEqual(input);
  });
});

describe("isNeutralEdit", () => {
  it("rozpozná originál", () => {
    expect(isNeutralEdit(NEUTRAL_EDIT)).toBe(true);
    expect(isNeutralEdit({ ...NEUTRAL_EDIT, rotate: 90 })).toBe(false);
    expect(isNeutralEdit({ ...NEUTRAL_EDIT, crop: "1:1" })).toBe(false);
    expect(isNeutralEdit({ ...NEUTRAL_EDIT, brightness: 1.1 })).toBe(false);
  });
});

describe("rotatedDimensions", () => {
  it("90/270 prohodí strany, 0/180 ne", () => {
    expect(rotatedDimensions(1600, 900, 0)).toEqual({ width: 1600, height: 900 });
    expect(rotatedDimensions(1600, 900, 180)).toEqual({ width: 1600, height: 900 });
    expect(rotatedDimensions(1600, 900, 90)).toEqual({ width: 900, height: 1600 });
    expect(rotatedDimensions(1600, 900, 270)).toEqual({ width: 900, height: 1600 });
  });
});

describe("centeredAspctCrop", () => {
  it("čtverec z landscape má stranu = výška a je vycentrovaný", () => {
    expect(centeredAspectCrop(1600, 900, 1, 1)).toEqual({
      left: 350,
      top: 0,
      width: 900,
      height: 900,
    });
  });

  it("16:9 z portrait limituje šířka", () => {
    const crop = centeredAspectCrop(900, 1600, 16, 9);
    expect(crop.width).toBe(900);
    expect(crop.height).toBe(Math.round(900 / (16 / 9)));
    expect(crop.left).toBe(0);
  });

  it("výřez nikdy nepřeteče plátno", () => {
    const crop = centeredAspectCrop(100, 100, 16, 9);
    expect(crop.left + crop.width).toBeLessThanOrEqual(100);
    expect(crop.top + crop.height).toBeLessThanOrEqual(100);
  });
});

describe("editedDimensions", () => {
  it("skládá rotaci a crop (nejdřív rotace, pak výřez)", () => {
    // 1600×900 → rotace 90 → 900×1600 → crop 1:1 → 900×900.
    expect(
      editedDimensions(1600, 900, { ...NEUTRAL_EDIT, rotate: 90, crop: "1:1" }),
    ).toEqual({ width: 900, height: 900 });
  });

  it("free = rozměry po rotaci", () => {
    expect(editedDimensions(1600, 900, { ...NEUTRAL_EDIT, rotate: 90 })).toEqual({
      width: 900,
      height: 1600,
    });
  });
});

describe("checkCrop", () => {
  it("free vždy projde", () => {
    expect(checkCrop(10, 10, NEUTRAL_EDIT).ok).toBe(true);
  });

  it("výřez pod minimem se odmítne", () => {
    // 60×60 → čtverec 60×60 OK; ale 16:9 dá výšku 34 px < 50 → odmítnout.
    expect(checkCrop(60, 60, { ...NEUTRAL_EDIT, crop: "1:1" }).ok).toBe(true);
    const tooSmall = checkCrop(60, 60, { ...NEUTRAL_EDIT, crop: "16:9" });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.message).toContain(String(MIN_CROP_PX));
  });

  it("dostatečně velký obrázek projde všemi presety", () => {
    for (const crop of ["1:1", "4:3", "16:9"] as const) {
      expect(checkCrop(1600, 1200, { ...NEUTRAL_EDIT, crop }).ok).toBe(true);
    }
  });
});
