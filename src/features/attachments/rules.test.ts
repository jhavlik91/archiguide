import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  decideAccess,
  isMoreOpen,
  requiresSensitiveConfirmation,
  type AccessFacts,
} from "./rules";
import { ATTACHMENT_VISIBILITIES, type AttachmentVisibility } from "./types";

const owner: Actor = {
  kind: "user",
  userId: "owner-1",
  roles: ["client"],
  activeContext: "client",
};
const participant: Actor = {
  kind: "user",
  userId: "participant-1",
  roles: ["professional"],
  activeContext: "professional",
};
const stranger: Actor = {
  kind: "user",
  userId: "stranger-1",
  roles: ["professional"],
  activeContext: "professional",
};
const admin: Actor = {
  kind: "user",
  userId: "admin-1",
  roles: ["admin"],
  activeContext: "client",
};

function facts(
  visibility: AttachmentVisibility,
  isParticipant: boolean,
): AccessFacts {
  return { ownerUserId: "owner-1", visibility, isParticipant };
}

describe("decideAccess — matice viditelnost × role", () => {
  it("vlastník vidí přílohu vždy (i private)", () => {
    for (const v of ATTACHMENT_VISIBILITIES) {
      expect(decideAccess(owner, facts(v, false))).toBe(true);
    }
  });

  it("private nevidí nikdo kromě vlastníka (ani admin, ani návštěvník)", () => {
    expect(decideAccess(stranger, facts("private", false))).toBe(false);
    expect(decideAccess(participant, facts("private", true))).toBe(false);
    expect(decideAccess(admin, facts("private", false))).toBe(false);
    expect(decideAccess(VISITOR, facts("private", false))).toBe(false);
  });

  it("shared_in_context vidí jen účastník kontextu", () => {
    expect(decideAccess(participant, facts("shared_in_context", true))).toBe(
      true,
    );
    expect(decideAccess(stranger, facts("shared_in_context", false))).toBe(
      false,
    );
    expect(decideAccess(VISITOR, facts("shared_in_context", false))).toBe(
      false,
    );
    // Admin bez účasti v kontextu nemá přístup (least privilege).
    expect(decideAccess(admin, facts("shared_in_context", false))).toBe(false);
  });

  it("public vidí kdokoli, včetně návštěvníka", () => {
    expect(decideAccess(stranger, facts("public", false))).toBe(true);
    expect(decideAccess(VISITOR, facts("public", false))).toBe(true);
  });
});

describe("isMoreOpen", () => {
  it("posun k otevřenější viditelnosti je 'více otevřený'", () => {
    expect(isMoreOpen("shared_in_context", "private")).toBe(true);
    expect(isMoreOpen("public", "private")).toBe(true);
    expect(isMoreOpen("public", "shared_in_context")).toBe(true);
  });
  it("zpřísnění ani beze změny není 'více otevřený'", () => {
    expect(isMoreOpen("private", "public")).toBe(false);
    expect(isMoreOpen("shared_in_context", "public")).toBe(false);
    expect(isMoreOpen("public", "public")).toBe(false);
  });
});

describe("requiresSensitiveConfirmation", () => {
  it("citlivá příloha vyžaduje potvrzení při zpřístupnění", () => {
    expect(requiresSensitiveConfirmation("private", "public", true)).toBe(true);
    expect(
      requiresSensitiveConfirmation("private", "shared_in_context", true),
    ).toBe(true);
  });
  it("necitlivá příloha potvrzení nevyžaduje", () => {
    expect(requiresSensitiveConfirmation("private", "public", false)).toBe(
      false,
    );
  });
  it("zpřísnění citlivé přílohy potvrzení nevyžaduje", () => {
    expect(requiresSensitiveConfirmation("public", "private", true)).toBe(
      false,
    );
  });
});
