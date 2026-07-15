import { describe, expect, it } from "vitest";
import type { BriefContent } from "@/features/brief/types";
import {
  buildRequestPublicView,
  isMoreOpenVisibility,
  type RequestPublicSource,
} from "./public-view";

/**
 * Testy whitelist projekce poptávky (T025 § Validation — „unit test garantuje,
 * že DTO neobsahuje privátní pole"). `buildRequestPublicView` je čistá funkce:
 * ověřujeme, že výstup nikdy nenese identitu vlastníka ani přesnou adresu, i
 * když by je zdroj obsahoval.
 */

const SOURCE: RequestPublicSource = {
  id: "r1",
  type: "b2c",
  status: "active",
  title: "Rekonstrukce bytu",
  targetProfessionSlugs: ["architekt"],
  region: "Praha",
  budget: "500 000 - 800 000 Kč",
  timeline: "do 6 měsíců",
  deadline: null,
  publishedAt: "2026-07-01T00:00:00.000Z",
};

function content(overrides: Partial<BriefContent> = {}): BriefContent {
  return {
    version: 1,
    summary: "Rekonstrukce bytu 3+kk.",
    goal: "Zvětšit kuchyň",
    projectType: "Rekonstrukce",
    currentState: null,
    scope: null,
    location: { display: "Praha", address: "Dlouhá 5", shareAddress: false },
    budget: { known: true, display: "500 000 - 800 000 Kč" },
    timing: "do 6 měsíců",
    inputs: { count: 0, mediaIds: [] },
    missingInputs: [],
    preferences: [],
    risks: [],
    recommendedProfessions: [],
    nextStep: null,
    ...overrides,
  };
}

describe("buildRequestPublicView", () => {
  it("neobsahuje ownerUserId ani briefId — DTO tato pole strukturálně nemá", () => {
    const view = buildRequestPublicView(SOURCE, null);
    expect(view).not.toHaveProperty("ownerUserId");
    expect(view).not.toHaveProperty("briefId");
    expect(view).not.toHaveProperty("briefSnapshot");
  });

  it("obsahuje jen whitelistovaná pole poptávky", () => {
    const view = buildRequestPublicView(SOURCE, null);
    expect(view).toEqual({
      id: "r1",
      type: "b2c",
      status: "active",
      title: "Rekonstrukce bytu",
      targetProfessionSlugs: ["architekt"],
      region: "Praha",
      budget: "500 000 - 800 000 Kč",
      timeline: "do 6 měsíců",
      deadline: null,
      publishedAt: "2026-07-01T00:00:00.000Z",
      briefPreview: null,
    });
  });

  it("redaguje přesnou adresu z briefu (nikdy ji nevrátí)", () => {
    const view = buildRequestPublicView(SOURCE, content());
    expect(view.briefPreview?.location?.address).toBeUndefined();
    expect(view.briefPreview?.location?.display).toBe("Praha");
  });

  it("brief bez lokality zůstává beze změny", () => {
    const view = buildRequestPublicView(SOURCE, content({ location: null }));
    expect(view.briefPreview?.location).toBeNull();
  });

  it("null briefContent → briefPreview je null (poptávka bez publikace)", () => {
    const view = buildRequestPublicView(
      { ...SOURCE, status: "draft", publishedAt: null },
      null,
    );
    expect(view.briefPreview).toBeNull();
  });
});

describe("isMoreOpenVisibility", () => {
  it("private → public je zpřístupnění", () => {
    expect(isMoreOpenVisibility("public", "private")).toBe(true);
  });

  it("public → private NENÍ zpřístupnění (zpřísnění)", () => {
    expect(isMoreOpenVisibility("private", "public")).toBe(false);
  });

  it("beze změny není zpřístupnění", () => {
    expect(isMoreOpenVisibility("public", "public")).toBe(false);
  });

  it("private → shared_link je zpřístupnění", () => {
    expect(isMoreOpenVisibility("shared_link", "private")).toBe(true);
  });
});
