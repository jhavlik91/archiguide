import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import { canCreateBrief, canReadBrief, canWriteBrief } from "./permissions";

/**
 * Testy oprávnění briefu (T021). Matice „Vytvořit brief": klient/profík/admin Y,
 * moderátor N, návštěvník C (řeší akce redirectem na registraci). Čtení/psaní
 * jen vlastník.
 */

const client: Actor = {
  kind: "user",
  userId: "u-client",
  roles: ["client"],
  activeContext: "client",
};
const professional: Actor = {
  kind: "user",
  userId: "u-pro",
  roles: ["professional"],
  activeContext: "professional",
};
const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};
const moderator: Actor = {
  kind: "user",
  userId: "u-mod",
  roles: ["moderator"],
  activeContext: "client",
};

const noRole: Actor = {
  kind: "user",
  userId: "u-fresh",
  roles: [],
  activeContext: "client",
};
const moderatorAlsoClient: Actor = {
  kind: "user",
  userId: "u-modclient",
  roles: ["moderator", "client"],
  activeContext: "client",
};

describe("canCreateBrief", () => {
  it("povolí klientovi, profesionálovi i adminovi", () => {
    expect(canCreateBrief(client)).toBe(true);
    expect(canCreateBrief(professional)).toBe(true);
    expect(canCreateBrief(admin)).toBe(true);
  });

  it("povolí čerstvě zaregistrovanému bez role (default B2C klient)", () => {
    expect(canCreateBrief(noRole)).toBe(true);
  });

  it("nepovolí účtu POUZE s rolí moderátor (matice „N“)", () => {
    expect(canCreateBrief(moderator)).toBe(false);
  });

  it("povolí účtu, který je moderátor i klient zároveň", () => {
    expect(canCreateBrief(moderatorAlsoClient)).toBe(true);
  });

  it("nepovolí návštěvníkovi (podmíněno registrací)", () => {
    expect(canCreateBrief(VISITOR)).toBe(false);
  });
});

describe("canReadBrief / canWriteBrief — jen vlastník", () => {
  const subject = { ownerUserId: "u-client" };

  it("vlastník smí číst i psát", () => {
    expect(canReadBrief(client, subject)).toBe(true);
    expect(canWriteBrief(client, subject)).toBe(true);
  });

  it("cizí uživatel (i admin) nesmí — brief je soukromý", () => {
    expect(canReadBrief(professional, subject)).toBe(false);
    expect(canWriteBrief(professional, subject)).toBe(false);
    expect(canReadBrief(admin, subject)).toBe(false);
  });

  it("návštěvník nesmí", () => {
    expect(canReadBrief(VISITOR, subject)).toBe(false);
    expect(canWriteBrief(VISITOR, subject)).toBe(false);
  });
});
