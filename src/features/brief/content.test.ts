import { describe, expect, it } from "vitest";
import { parseBriefContent, serializeBriefContent } from "./content";
import type { BriefContent } from "./types";

/**
 * Testy snapshot kontraktu obsahu briefu (T021). `serialize` ověří tvar při
 * zápisu; `parse` čte zpět bezpečně (nevalidní/starší snapshot → null → fallback).
 */

const valid: BriefContent = {
  version: 1,
  summary: "Záměr: Rekonstrukce bytu v lokalitě Praha.",
  goal: "Rekonstrukce bytu – Praha",
  projectType: "Rekonstrukce bytu",
  currentState: "Již vlastním",
  scope: "Kuchyň",
  location: { display: "Praha", address: "Dlouhá 12", shareAddress: false },
  budget: { known: true, display: "500 000 Kč" },
  timing: "Do 3 měsíců",
  inputs: { count: 1, mediaIds: ["m1"] },
  missingInputs: [],
  preferences: [
    { key: "custom_furniture", label: "Nábytek na míru?", value: "Ano" },
  ],
  risks: [],
  recommendedProfessions: [
    { slug: "architekt", name: "Architekt", reason: "Návrh dispozice." },
  ],
  nextStep: "Oslovte architekta.",
};

describe("serializeBriefContent", () => {
  it("propustí validní obsah beze změny", () => {
    expect(serializeBriefContent(valid)).toEqual(valid);
  });
});

describe("parseBriefContent", () => {
  it("přečte validní snapshot", () => {
    expect(parseBriefContent(valid)).toEqual(valid);
  });

  it("vrátí null pro nevalidní/cizí tvar", () => {
    expect(parseBriefContent(null)).toBeNull();
    expect(parseBriefContent({ version: 2 })).toBeNull();
    expect(parseBriefContent({ foo: "bar" })).toBeNull();
  });
});
