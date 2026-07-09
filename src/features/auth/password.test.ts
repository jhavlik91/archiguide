import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("ověří správné heslo a odmítne špatné", async () => {
    const hash = await hashPassword("tajneheslo1");
    expect(hash).not.toBe("tajneheslo1");
    expect(await verifyPassword("tajneheslo1", hash)).toBe(true);
    expect(await verifyPassword("spatneheslo", hash)).toBe(false);
  });
});
