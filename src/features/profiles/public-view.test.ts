import { describe, expect, it } from "vitest";
import { isIndexable, resolvePublicView } from "./public-view";

const base = {
  status: "published",
  userStatus: "active",
  isOwner: false,
  preview: false,
} as const;

describe("resolvePublicView", () => {
  it("publikovaný profil aktivního uživatele je veřejný", () => {
    expect(resolvePublicView(base)).toEqual({ visible: true, mode: "public" });
  });

  it("publikovaný profil vidí i přihlášený vlastník (public)", () => {
    expect(resolvePublicView({ ...base, isOwner: true })).toEqual({
      visible: true,
      mode: "public",
    });
  });

  it("draft je pro cizího návštěvníka nedostupný", () => {
    expect(resolvePublicView({ ...base, status: "draft" })).toEqual({
      visible: false,
    });
  });

  it("draft vidí vlastník jen v režimu náhledu", () => {
    expect(
      resolvePublicView({ ...base, status: "draft", isOwner: true }),
    ).toEqual({ visible: false });
    expect(
      resolvePublicView({
        ...base,
        status: "draft",
        isOwner: true,
        preview: true,
      }),
    ).toEqual({ visible: true, mode: "preview" });
  });

  it("náhled draftu nefunguje pro cizího uživatele ani s preview flagem", () => {
    expect(
      resolvePublicView({ ...base, status: "draft", preview: true }),
    ).toEqual({ visible: false });
  });

  it("deaktivovaný/smazaný uživatel je nedostupný i s publikovaným profilem", () => {
    expect(resolvePublicView({ ...base, userStatus: "deactivated" })).toEqual({
      visible: false,
    });
    expect(
      resolvePublicView({
        ...base,
        userStatus: "deleted",
        isOwner: true,
        preview: true,
        status: "draft",
      }),
    ).toEqual({ visible: false });
  });
});

describe("isIndexable", () => {
  it("indexuje jen veřejný render, ne náhled", () => {
    expect(isIndexable({ visible: true, mode: "public" })).toBe(true);
    expect(isIndexable({ visible: true, mode: "preview" })).toBe(false);
    expect(isIndexable({ visible: false })).toBe(false);
  });
});
