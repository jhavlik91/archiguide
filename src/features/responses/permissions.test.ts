import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import {
  canCreateResponse,
  canManageResponse,
  canReadResponse,
  canWriteResponse,
} from "./permissions";

/**
 * Testy oprávnění reakce na poptávku (T027, zadani/05 — „Reagovat na poptávku":
 * N | C | C | Y | Y | C | N | Y). Vytvořit smí profesionál (nebo org editor+
 * za firmu) jen na `active` poptávku; číst autor + vlastník; spravovat
 * (shortlist/přijmout/odmítnout) jen vlastník; psát (editace/withdraw) jen autor.
 */

const AUTHOR_ID = "u-author";
const OWNER_ID = "u-owner";
const ORG_ID = "org-1";

const professional: Actor = {
  kind: "user",
  userId: AUTHOR_ID,
  roles: ["professional"],
  activeContext: "professional",
};
const clientOnly: Actor = {
  kind: "user",
  userId: AUTHOR_ID,
  roles: ["client"],
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
  userId: AUTHOR_ID,
  roles: ["moderator"],
  activeContext: "client",
};
const owner: Actor = {
  kind: "user",
  userId: OWNER_ID,
  roles: ["client"],
  activeContext: "client",
};
const stranger: Actor = {
  kind: "user",
  userId: "u-other",
  roles: ["professional"],
  activeContext: "professional",
};

describe("canCreateResponse", () => {
  const openRequest = {
    requestStatus: "active" as const,
    requestVisibility: "public" as const,
    isInvited: false,
  };

  it("profesionál smí reagovat za sebe na aktivní poptávku", () => {
    expect(
      canCreateResponse(professional, {
        author: { type: "user", userId: AUTHOR_ID },
        ...openRequest,
      }),
    ).toBe(true);
  });

  it("bez role profesionál (jen klient) nesmí reagovat za sebe", () => {
    expect(
      canCreateResponse(clientOnly, {
        author: { type: "user", userId: AUTHOR_ID },
        ...openRequest,
      }),
    ).toBe(false);
  });

  it("účet POUZE s rolí moderátor nesmí reagovat", () => {
    expect(
      canCreateResponse(moderatorOnly, {
        author: { type: "user", userId: AUTHOR_ID },
        ...openRequest,
      }),
    ).toBe(false);
  });

  it("návštěvník nikdy", () => {
    expect(
      canCreateResponse(VISITOR, {
        author: { type: "user", userId: AUTHOR_ID },
        ...openRequest,
      }),
    ).toBe(false);
  });

  it("mimo `active` reagovat nelze, ani vlastní profesionální účet", () => {
    expect(
      canCreateResponse(professional, {
        author: { type: "user", userId: AUTHOR_ID },
        requestStatus: "paused",
        requestVisibility: "public",
        isInvited: false,
      }),
    ).toBe(false);
  });

  it("neveřejnou aktivní poptávku smí jen pozvaný profesionál", () => {
    const subject = {
      author: { type: "user" as const, userId: AUTHOR_ID },
      requestStatus: "active" as const,
      requestVisibility: "private" as const,
      isInvited: false,
    };
    expect(canCreateResponse(professional, subject)).toBe(false);
    expect(canCreateResponse(professional, { ...subject, isInvited: true })).toBe(
      true,
    );
  });

  it("cizí uživatel nesmí reagovat jménem jiného profesionála", () => {
    expect(
      canCreateResponse(stranger, {
        author: { type: "user", userId: AUTHOR_ID },
        ...openRequest,
      }),
    ).toBe(false);
  });

  it("firemní reakce vyžaduje org editor+ (matice — Firma admin Y, editor C)", () => {
    const subject = {
      author: { type: "organization" as const, orgId: ORG_ID },
      ...openRequest,
    };
    expect(canCreateResponse(professional, { ...subject, isOrgEditor: false })).toBe(
      false,
    );
    expect(canCreateResponse(professional, { ...subject, isOrgEditor: true })).toBe(
      true,
    );
  });

  it("admin smí reagovat i za cizí profesionální účet (matice — Admin Y)", () => {
    expect(
      admin.userId !== AUTHOR_ID &&
        canCreateResponse(admin, {
          author: { type: "user", userId: AUTHOR_ID },
          ...openRequest,
        }),
    ).toBe(true);
  });
});

describe("canReadResponse — autor a vlastník poptávky", () => {
  const subject = {
    author: { type: "user" as const, userId: AUTHOR_ID },
    requestOwnerUserId: OWNER_ID,
  };

  it("autor i vlastník poptávky smí číst", () => {
    expect(canReadResponse(professional, subject)).toBe(true);
    expect(canReadResponse(owner, subject)).toBe(true);
    expect(canReadResponse(admin, subject)).toBe(true);
  });

  it("cizí uživatel a návštěvník nesmí", () => {
    expect(canReadResponse(stranger, subject)).toBe(false);
    expect(canReadResponse(VISITOR, subject)).toBe(false);
  });

  it("firemní reakci smí číst jen člen autorské organizace", () => {
    const orgSubject = {
      author: { type: "organization" as const, orgId: ORG_ID },
      requestOwnerUserId: OWNER_ID,
    };
    expect(canReadResponse(stranger, { ...orgSubject, isOrgMember: false })).toBe(
      false,
    );
    expect(canReadResponse(stranger, { ...orgSubject, isOrgMember: true })).toBe(
      true,
    );
  });
});

describe("canWriteResponse — jen autor (editace/withdraw)", () => {
  const subject = { author: { type: "user" as const, userId: AUTHOR_ID } };

  it("autor i admin smí", () => {
    expect(canWriteResponse(professional, subject)).toBe(true);
    expect(canWriteResponse(admin, subject)).toBe(true);
  });

  it("vlastník poptávky (není autor) nesmí", () => {
    expect(canWriteResponse(owner, subject)).toBe(false);
  });
});

describe("canManageResponse — jen vlastník poptávky (shortlist/přijmout/odmítnout)", () => {
  const subject = { requestOwnerUserId: OWNER_ID };

  it("vlastník i admin smí", () => {
    expect(canManageResponse(owner, subject)).toBe(true);
    expect(canManageResponse(admin, subject)).toBe(true);
  });

  it("autor reakce (není vlastník) nesmí spravovat vlastní reakci", () => {
    expect(canManageResponse(professional, subject)).toBe(false);
  });
});
