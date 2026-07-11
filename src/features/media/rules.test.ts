import { describe, expect, it } from "vitest";
import { decideDelete, ownerRefOf } from "./rules";
import type { MediaUsage } from "./usage";

const draftUsage: MediaUsage = { label: "Portfolio: Vila (draft)", published: false };
const publishedUsage: MediaUsage = {
  label: "Portfolio: Vila",
  href: "/portfolio/p1",
  published: true,
};

describe("decideDelete", () => {
  it("nepoužitý asset se měkce smaže bez varování", () => {
    expect(decideDelete([])).toEqual({ kind: "soft_delete" });
  });

  it("použití jen v draftu → měkké smazání s varováním", () => {
    const decision = decideDelete([draftUsage]);
    expect(decision.kind).toBe("soft_delete_warn");
    if (decision.kind === "soft_delete_warn") {
      expect(decision.usages).toHaveLength(1);
    }
  });

  it("použití v publikovaném obsahu → blokováno se seznamem míst", () => {
    const decision = decideDelete([draftUsage, publishedUsage]);
    expect(decision.kind).toBe("blocked");
    if (decision.kind === "blocked") {
      // Blok uvádí jen publikovaná místa (kde je asset opravdu veřejně).
      expect(decision.usages).toEqual([publishedUsage]);
    }
  });
});

describe("ownerRefOf", () => {
  it("odvodí uživatelského vlastníka", () => {
    expect(ownerRefOf({ ownerUserId: "u1", ownerOrgId: null })).toEqual({
      type: "user",
      userId: "u1",
    });
  });

  it("odvodí organizaci, když uživatel chybí", () => {
    expect(ownerRefOf({ ownerUserId: null, ownerOrgId: "o1" })).toEqual({
      type: "organization",
      orgId: "o1",
    });
  });
});
