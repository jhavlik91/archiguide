import { describe, expect, it } from "vitest";
import {
  canAcceptRequests,
  canPublish,
  normalizeProfessionLinks,
  publishBlockers,
  resolvePrimary,
} from "./rules";
import type { ProfessionLink } from "./types";

describe("normalizeProfessionLinks", () => {
  it("povýší první profesi na hlavní, když žádná není označená", () => {
    const out = normalizeProfessionLinks([
      { professionId: "a", isPrimary: false },
      { professionId: "b", isPrimary: false },
    ]);
    expect(out).toEqual([
      { professionId: "a", isPrimary: true },
      { professionId: "b", isPrimary: false },
    ]);
  });

  it("ponechá právě jednu hlavní, když je jich označeno víc", () => {
    const out = normalizeProfessionLinks([
      { professionId: "a", isPrimary: false },
      { professionId: "b", isPrimary: true },
      { professionId: "c", isPrimary: true },
    ]);
    expect(out.filter((l) => l.isPrimary)).toEqual([
      { professionId: "b", isPrimary: true },
    ]);
  });

  it("deduplikuje podle professionId (zachová první výskyt)", () => {
    const out = normalizeProfessionLinks([
      { professionId: "a", isPrimary: false },
      { professionId: "a", isPrimary: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ professionId: "a", isPrimary: true });
  });

  it("prázdný vstup dá prázdný výstup", () => {
    expect(normalizeProfessionLinks([])).toEqual([]);
  });
});

describe("resolvePrimary", () => {
  it("vrátí hlavní profesi", () => {
    const links: ProfessionLink[] = [
      { professionId: "a", isPrimary: false },
      { professionId: "b", isPrimary: true },
    ];
    expect(resolvePrimary(links)?.professionId).toBe("b");
  });

  it("vrátí null bez hlavní profese", () => {
    expect(resolvePrimary([])).toBeNull();
  });
});

describe("canAcceptRequests", () => {
  it("vyžaduje alespoň jednu profesi", () => {
    expect(canAcceptRequests(0)).toBe(false);
    expect(canAcceptRequests(1)).toBe(true);
    expect(canAcceptRequests(3)).toBe(true);
  });
});

describe("publikace", () => {
  it("blokuje bez titulku i bez profese", () => {
    expect(publishBlockers({ headline: "", professionCount: 0 })).toHaveLength(
      2,
    );
    expect(canPublish({ headline: "", professionCount: 0 })).toBe(false);
  });

  it("blokuje jen prázdný titulek (samotné mezery)", () => {
    expect(canPublish({ headline: "   ", professionCount: 1 })).toBe(false);
  });

  it("blokuje bez profese i s titulkem", () => {
    expect(canPublish({ headline: "Architekt", professionCount: 0 })).toBe(
      false,
    );
  });

  it("povolí publikaci s titulkem a profesí", () => {
    expect(canPublish({ headline: "Architekt", professionCount: 1 })).toBe(
      true,
    );
    expect(publishBlockers({ headline: "Architekt", professionCount: 1 })).toEqual(
      [],
    );
  });
});
