import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canManageMedia,
  canUploadMedia,
  canViewMedia,
} from "./permissions";
import type { MediaOwnerRef } from "./rules";

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

const userOwner: MediaOwnerRef = { type: "user", userId: "owner-1" };
const orgOwner: MediaOwnerRef = { type: "organization", orgId: "org-1" };

describe("canUploadMedia", () => {
  it("uživatel nahrává do své knihovny; návštěvník ne", () => {
    expect(canUploadMedia(owner, { owner: userOwner })).toBe(true);
    expect(canUploadMedia(stranger, { owner: userOwner })).toBe(false);
    expect(canUploadMedia(VISITOR, { owner: userOwner })).toBe(false);
  });

  it("firemní upload smí jen org editor+ (nebo admin)", () => {
    expect(canUploadMedia(owner, { owner: orgOwner, isOrgEditor: true })).toBe(true);
    expect(canUploadMedia(owner, { owner: orgOwner, isOrgEditor: false })).toBe(false);
    expect(canUploadMedia(admin, { owner: orgOwner, isOrgEditor: false })).toBe(true);
  });
});

describe("canManageMedia", () => {
  it("spravuje jen vlastník a systémový admin", () => {
    expect(canManageMedia(owner, { owner: userOwner })).toBe(true);
    expect(canManageMedia(stranger, { owner: userOwner })).toBe(false);
    expect(canManageMedia(admin, { owner: userOwner })).toBe(true);
  });
});

describe("canViewMedia", () => {
  it("soukromý asset vidí jen vlastník (i pro originál)", () => {
    expect(canViewMedia(owner, { owner: userOwner })).toBe(true);
    expect(canViewMedia(stranger, { owner: userOwner })).toBe(false);
    expect(canViewMedia(VISITOR, { owner: userOwner })).toBe(false);
  });

  it("veřejný derivát (použit v publikovaném) vidí kdokoli", () => {
    expect(
      canViewMedia(VISITOR, { owner: userOwner, isPublicDerivative: true }),
    ).toBe(true);
    expect(
      canViewMedia(stranger, { owner: userOwner, isPublicDerivative: true }),
    ).toBe(true);
  });

  it("člen vlastníkovské firmy vidí firemní asset", () => {
    expect(canViewMedia(stranger, { owner: orgOwner, isOrgMember: true })).toBe(true);
    expect(canViewMedia(stranger, { owner: orgOwner, isOrgMember: false })).toBe(false);
  });
});
