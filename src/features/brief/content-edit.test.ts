import { describe, expect, it } from "vitest";
import { applyBriefEdit, briefEditSchema, redactBriefPrivate } from "./content";
import type { BriefContent } from "./types";

/**
 * Editace snapshotu §18 (T022): Zod validace per sekce + merge, který zachová
 * odvozená pole a nikdy nezobrazí prázdný rozpočet; a redakce soukromých polí
 * pro sdílení/export.
 */

function baseContent(): BriefContent {
  return {
    version: 1,
    summary: "Původní shrnutí",
    goal: "Původní cíl",
    projectType: "Rekonstrukce",
    currentState: null,
    scope: null,
    location: { display: "Praha", address: "Dlouhá 5", shareAddress: false },
    budget: { known: true, display: "2 000 000 Kč" },
    timing: null,
    inputs: { count: 2, mediaIds: ["m1", "m2"] },
    missingInputs: ["Rozpočet"],
    preferences: [],
    risks: [],
    recommendedProfessions: [
      { slug: "architekt", name: "Architekt", reason: "" },
    ],
    nextStep: null,
  };
}

describe("briefEditSchema", () => {
  it("prázdný název odmítne", () => {
    const parsed = briefEditSchema.safeParse({ ...validInput(), title: "  " });
    expect(parsed.success).toBe(false);
  });

  it("prázdný nepovinný text normalizuje na null", () => {
    const parsed = briefEditSchema.parse({ ...validInput(), timing: "  " });
    expect(parsed.timing).toBeNull();
  });

  it("lokalita bez veřejného popisu se zahodí (null)", () => {
    const parsed = briefEditSchema.parse({
      ...validInput(),
      location: { display: "", address: "Tajná 1", shareAddress: true },
    });
    expect(parsed.location).toBeNull();
  });
});

describe("applyBriefEdit", () => {
  it("zachová odvozená pole a přepíše editovatelná", () => {
    const merged = applyBriefEdit(baseContent(), {
      ...validInput(),
      summary: "Nové shrnutí",
    });
    expect(merged.summary).toBe("Nové shrnutí");
    // Odvozená pole zůstávají.
    expect(merged.inputs).toEqual({ count: 2, mediaIds: ["m1", "m2"] });
    expect(merged.missingInputs).toEqual(["Rozpočet"]);
    expect(merged.version).toBe(1);
  });

  it("rozpočet known:false → „Rozpočet neuveden“, nikdy prázdno", () => {
    const merged = applyBriefEdit(baseContent(), {
      ...validInput(),
      budget: { known: false, display: "" },
    });
    expect(merged.budget.display).toBe("Rozpočet neuveden");
  });
});

describe("redactBriefPrivate", () => {
  it("odstraní přesnou adresu, veřejnou lokalitu zachová", () => {
    const redacted = redactBriefPrivate(baseContent());
    expect(redacted.location).toEqual({
      display: "Praha",
      shareAddress: false,
    });
  });

  it("bez adresy vrací obsah beze změny", () => {
    const c = baseContent();
    c.location = { display: "Brno", shareAddress: false };
    expect(redactBriefPrivate(c)).toBe(c);
  });
});

function validInput() {
  return {
    title: "Rekonstrukce bytu",
    summary: "Shrnutí",
    goal: "Cíl",
    projectType: "Rekonstrukce",
    currentState: null,
    scope: null,
    location: { display: "Praha", shareAddress: false },
    budget: { known: true, display: "2 mil." },
    timing: null,
    preferences: [],
    risks: [],
    recommendedProfessions: [],
    nextStep: null,
  };
}
