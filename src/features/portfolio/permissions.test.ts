import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canCreatePortfolio,
  canEditPortfolio,
  canViewPortfolio,
  type PortfolioOwnerRef,
  type PortfolioSubject,
} from "./permissions";

const owner: Actor = {
  kind: "user",
  userId: "owner-1",
  roles: ["professional"],
  activeContext: "professional",
};
const stranger: Actor = {
  kind: "user",
  userId: "other-1",
  roles: ["professional"],
  activeContext: "professional",
};
const admin: Actor = {
  kind: "user",
  userId: "admin-1",
  roles: ["admin"],
  activeContext: "client",
};

const userOwner: PortfolioOwnerRef = { type: "user", userId: "owner-1" };
const orgOwner: PortfolioOwnerRef = { type: "organization", orgId: "org-1" };

describe("canCreatePortfolio", () => {
  it("profesionál smí založit vlastní dílo", () => {
    expect(canCreatePortfolio(owner, { owner: userOwner })).toBe(true);
  });

  it("klient (bez role professional) vlastní dílo nezaloží", () => {
    const client: Actor = {
      kind: "user",
      userId: "owner-1",
      roles: ["client"],
      activeContext: "client",
    };
    expect(canCreatePortfolio(client, { owner: userOwner })).toBe(false);
  });

  it("firemní dílo smí založit jen org editor+", () => {
    expect(
      canCreatePortfolio(owner, { owner: orgOwner, isOrgEditor: true }),
    ).toBe(true);
    expect(
      canCreatePortfolio(owner, { owner: orgOwner, isOrgEditor: false }),
    ).toBe(false);
  });
});

describe("canEditPortfolio", () => {
  const draft: PortfolioSubject = { owner: userOwner, status: "draft" };

  it("edituje jen vlastník-uživatel (a systémový admin)", () => {
    expect(canEditPortfolio(owner, draft)).toBe(true);
    expect(canEditPortfolio(stranger, draft)).toBe(false);
    expect(canEditPortfolio(admin, draft)).toBe(true);
    expect(canEditPortfolio(VISITOR, draft)).toBe(false);
  });

  it("org-owned edituje jen org editor+", () => {
    const orgDraft: PortfolioSubject = { owner: orgOwner, status: "draft" };
    expect(canEditPortfolio(owner, { ...orgDraft, isOrgEditor: true })).toBe(
      true,
    );
    expect(canEditPortfolio(owner, { ...orgDraft, isOrgEditor: false })).toBe(
      false,
    );
  });
});

describe("canViewPortfolio", () => {
  it("publikované dílo vidí kdokoli včetně návštěvníka", () => {
    const published: PortfolioSubject = { owner: userOwner, status: "published" };
    expect(canViewPortfolio(VISITOR, published)).toBe(true);
    expect(canViewPortfolio(stranger, published)).toBe(true);
  });

  it("draft vidí jen vlastník, admin a pozvaný spoluautor", () => {
    const draft: PortfolioSubject = { owner: userOwner, status: "draft" };
    expect(canViewPortfolio(owner, draft)).toBe(true);
    expect(canViewPortfolio(admin, draft)).toBe(true);
    expect(canViewPortfolio(stranger, draft)).toBe(false);
    expect(canViewPortfolio(VISITOR, draft)).toBe(false);
    expect(
      canViewPortfolio(stranger, { ...draft, isInvitedCoauthor: true }),
    ).toBe(true);
  });

  it("archived dílo není veřejné (jen editoři)", () => {
    const archived: PortfolioSubject = { owner: userOwner, status: "archived" };
    expect(canViewPortfolio(VISITOR, archived)).toBe(false);
    expect(canViewPortfolio(owner, archived)).toBe(true);
  });
});
