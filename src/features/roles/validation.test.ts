import { describe, expect, it } from "vitest";
import { claimRoleSchema, contextSchema, roleSchema } from "./validation";

describe("roleSchema", () => {
  it("přijme systémové role", () => {
    for (const role of ["client", "professional", "moderator", "admin"]) {
      expect(roleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("odmítne neznámou roli", () => {
    expect(roleSchema.safeParse("owner").success).toBe(false);
  });
});

describe("contextSchema", () => {
  it("přijme jen client/professional", () => {
    expect(contextSchema.safeParse("client").success).toBe(true);
    expect(contextSchema.safeParse("professional").success).toBe(true);
    expect(contextSchema.safeParse("admin").success).toBe(false);
  });
});

describe("claimRoleSchema", () => {
  it("povolí self-service role client/professional", () => {
    expect(claimRoleSchema.safeParse("client").success).toBe(true);
    expect(claimRoleSchema.safeParse("professional").success).toBe(true);
  });

  it("nepovolí self-service moderator/admin", () => {
    expect(claimRoleSchema.safeParse("moderator").success).toBe(false);
    expect(claimRoleSchema.safeParse("admin").success).toBe(false);
  });
});
