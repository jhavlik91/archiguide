import { describe, expect, it } from "vitest";
import {
  roleChangeSchema,
  suspendUserSchema,
  userListFilterSchema,
} from "./validation";

describe("suspendUserSchema", () => {
  it("vyžaduje důvod (T035 § Validation)", () => {
    expect(suspendUserSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(suspendUserSchema.safeParse({}).success).toBe(false);
  });
  it("přijme rozumný důvod", () => {
    const result = suspendUserSchema.safeParse({ reason: "Spam a podvodné nabídky." });
    expect(result.success).toBe(true);
  });
});

describe("roleChangeSchema", () => {
  it("vyžaduje důvod a platnou roli/akci", () => {
    expect(
      roleChangeSchema.safeParse({ role: "admin", action: "grant", reason: "" })
        .success,
    ).toBe(false);
    expect(
      roleChangeSchema.safeParse({
        role: "neco",
        action: "grant",
        reason: "V pořádku, ověřeno.",
      }).success,
    ).toBe(false);
  });
  it("přijme platnou žádost o změnu role", () => {
    const result = roleChangeSchema.safeParse({
      role: "moderator",
      action: "revoke",
      reason: "Ukončení spolupráce.",
    });
    expect(result.success).toBe(true);
  });
});

describe("userListFilterSchema", () => {
  it("defaultuje na 'all' a stránku 1", () => {
    const result = userListFilterSchema.parse({});
    expect(result).toMatchObject({ role: "all", status: "all", verified: "all", page: 1 });
  });
});
