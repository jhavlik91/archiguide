import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import { canViewProfile } from "./permissions";

const owner: Actor = {
  kind: "user",
  userId: "owner-1",
  roles: ["professional"],
  activeContext: "professional",
};
const stranger: Actor = {
  kind: "user",
  userId: "other-1",
  roles: ["client"],
  activeContext: "client",
};

describe("canViewProfile", () => {
  it("publikovaný profil vidí kdokoli včetně návštěvníka", () => {
    const subject = { status: "published" as const, ownerId: "owner-1" };
    expect(canViewProfile(VISITOR, subject)).toBe(true);
    expect(canViewProfile(stranger, subject)).toBe(true);
    expect(canViewProfile(owner, subject)).toBe(true);
  });

  it("draft vidí jen vlastník", () => {
    const subject = { status: "draft" as const, ownerId: "owner-1" };
    expect(canViewProfile(owner, subject)).toBe(true);
    expect(canViewProfile(stranger, subject)).toBe(false);
    expect(canViewProfile(VISITOR, subject)).toBe(false);
  });
});
