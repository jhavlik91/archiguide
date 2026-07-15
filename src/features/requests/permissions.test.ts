import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canCreateRequest,
  canPublishRequest,
  canReadRequest,
  canWriteRequest,
} from "./permissions";

/**
 * Testy oprávnění poptávky (T024). Publikace dle matice (zadani/05): návštěvník
 * NIKDY, účet POUZE moderátor NIKDY; jinak vlastník smí (B2C i B2B), admin
 * cokoliv. CRUD/přechody jen vlastník nebo admin.
 */

const OWNER = "u-owner";
const client: Actor = {
  kind: "user",
  userId: OWNER,
  roles: ["client"],
  activeContext: "client",
};
const professional: Actor = {
  kind: "user",
  userId: OWNER,
  roles: ["professional"],
  activeContext: "professional",
};
const noRole: Actor = {
  kind: "user",
  userId: OWNER,
  roles: [],
  activeContext: "client",
};
const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};
const moderatorOnly: Actor = {
  kind: "user",
  userId: OWNER,
  roles: ["moderator"],
  activeContext: "client",
};
const stranger: Actor = {
  kind: "user",
  userId: "u-other",
  roles: ["client"],
  activeContext: "client",
};

describe("canCreateRequest", () => {
  it("povolí přihlášeným (i bez role), zakáže moderátor-only a návštěvníka", () => {
    expect(canCreateRequest(client)).toBe(true);
    expect(canCreateRequest(noRole)).toBe(true);
    expect(canCreateRequest(admin)).toBe(true);
    expect(canCreateRequest(moderatorOnly)).toBe(false);
    expect(canCreateRequest(VISITOR)).toBe(false);
  });
});

describe("canReadRequest / canWriteRequest — vlastník nebo admin", () => {
  const subject = { ownerUserId: OWNER };

  it("vlastník i admin smí číst a psát", () => {
    expect(canReadRequest(client, subject)).toBe(true);
    expect(canWriteRequest(client, subject)).toBe(true);
    expect(canReadRequest(admin, subject)).toBe(true);
    expect(canWriteRequest(admin, subject)).toBe(true);
  });

  it("cizí uživatel ani návštěvník nesmí", () => {
    expect(canReadRequest(stranger, subject)).toBe(false);
    expect(canWriteRequest(stranger, subject)).toBe(false);
    expect(canReadRequest(VISITOR, subject)).toBe(false);
  });
});

describe("canPublishRequest — dle matice", () => {
  it("návštěvník NIKDY (obě persony)", () => {
    expect(
      canPublishRequest(VISITOR, { ownerUserId: OWNER, type: "b2c" }),
    ).toBe(false);
    expect(
      canPublishRequest(VISITOR, { ownerUserId: OWNER, type: "b2b" }),
    ).toBe(false);
  });

  it("účet POUZE s rolí moderátor NIKDY", () => {
    expect(
      canPublishRequest(moderatorOnly, { ownerUserId: OWNER, type: "b2c" }),
    ).toBe(false);
    expect(
      canPublishRequest(moderatorOnly, { ownerUserId: OWNER, type: "b2b" }),
    ).toBe(false);
  });

  it("vlastník (klient i profesionál) smí publikovat B2C i B2B", () => {
    for (const actor of [client, professional, noRole]) {
      expect(
        canPublishRequest(actor, { ownerUserId: OWNER, type: "b2c" }),
      ).toBe(true);
      expect(
        canPublishRequest(actor, { ownerUserId: OWNER, type: "b2b" }),
      ).toBe(true);
    }
  });

  it("admin smí publikovat cizí poptávku; jiný uživatel ne", () => {
    expect(canPublishRequest(admin, { ownerUserId: OWNER, type: "b2b" })).toBe(
      true,
    );
    expect(
      canPublishRequest(stranger, { ownerUserId: OWNER, type: "b2c" }),
    ).toBe(false);
  });
});
