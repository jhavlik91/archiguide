import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canAccessModerationQueue,
  canActOnReport,
  canReportContent,
  canSuspendAccount,
} from "./permissions";

/**
 * Testy oprávnění moderace (T036 § Permissions): report smí kdokoliv přihlášený,
 * frontu a akce jen moderátor/admin, suspenzi jen admin.
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
const noRole: Actor = {
  kind: "user",
  userId: "u-norole",
  roles: [],
  activeContext: "client",
};
const moderator: Actor = {
  kind: "user",
  userId: "u-mod",
  roles: ["moderator"],
  activeContext: "client",
};
const admin: Actor = {
  kind: "user",
  userId: "u-admin",
  roles: ["admin"],
  activeContext: "client",
};

describe("canReportContent", () => {
  it("povolí libovolnému přihlášenému uživateli (i bez role)", () => {
    for (const actor of [client, professional, noRole, moderator, admin]) {
      expect(canReportContent(actor)).toBe(true);
    }
  });

  it("zakáže návštěvníkovi", () => {
    expect(canReportContent(VISITOR)).toBe(false);
  });
});

describe("canAccessModerationQueue / canActOnReport", () => {
  it("povolí moderátorovi a adminovi", () => {
    expect(canAccessModerationQueue(moderator)).toBe(true);
    expect(canAccessModerationQueue(admin)).toBe(true);
    expect(canActOnReport(moderator)).toBe(true);
    expect(canActOnReport(admin)).toBe(true);
  });

  it("zakáže klientovi, profesionálovi i návštěvníkovi", () => {
    for (const actor of [client, professional, noRole, VISITOR]) {
      expect(canAccessModerationQueue(actor)).toBe(false);
      expect(canActOnReport(actor)).toBe(false);
    }
  });
});

describe("canSuspendAccount — jen admin", () => {
  it("povolí adminovi", () => {
    expect(canSuspendAccount(admin)).toBe(true);
  });

  it("zakáže moderátorovi (dle T035 — jen admin) i ostatním", () => {
    for (const actor of [moderator, client, professional, noRole, VISITOR]) {
      expect(canSuspendAccount(actor)).toBe(false);
    }
  });
});
