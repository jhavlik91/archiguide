import { describe, expect, it } from "vitest";
import {
  changeRoleSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  updateOrganizationSchema,
} from "./validation";

describe("createOrganizationSchema", () => {
  it("název je povinný", () => {
    expect(createOrganizationSchema.safeParse({ name: "" }).success).toBe(
      false,
    );
    expect(createOrganizationSchema.safeParse({ name: "  " }).success).toBe(
      false,
    );
  });
  it("ořízne název a přijme volitelné IČO", () => {
    const parsed = createOrganizationSchema.parse({
      name: "  Studio A  ",
      businessId: "12345678",
    });
    expect(parsed.name).toBe("Studio A");
    expect(parsed.businessId).toBe("12345678");
  });
  it("prázdné IČO → undefined", () => {
    const parsed = createOrganizationSchema.parse({
      name: "X",
      businessId: "",
    });
    expect(parsed.businessId).toBeUndefined();
  });
});

describe("updateOrganizationSchema", () => {
  it("odmítne neplatnou URL loga", () => {
    const r = updateOrganizationSchema.safeParse({
      name: "X",
      logoUrl: "neni-url",
    });
    expect(r.success).toBe(false);
  });
  it("veřejný web bere jen http(s) — jiná schémata (javascript:) odmítne", () => {
    expect(
      updateOrganizationSchema.safeParse({
        name: "X",
        publicWebsite: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    const parsed = updateOrganizationSchema.parse({
      name: "X",
      publicWebsite: "https://firma.cz",
    });
    expect(parsed.publicWebsite).toBe("https://firma.cz");
  });
  it("deduplikuje regiony a specializace", () => {
    const parsed = updateOrganizationSchema.parse({
      name: "X",
      serviceAreas: ["Praha", "Praha", "Brno"],
      specializations: ["novostavby", "novostavby"],
    });
    expect(parsed.serviceAreas).toEqual(["Praha", "Brno"]);
    expect(parsed.specializations).toEqual(["novostavby"]);
  });
});

describe("inviteMemberSchema", () => {
  it("e-mail se normalizuje na lowercase, výchozí role member", () => {
    const parsed = inviteMemberSchema.parse({ email: "Foo@X.CZ" });
    expect(parsed.email).toBe("foo@x.cz");
    expect(parsed.role).toBe("member");
  });
  it("owner nelze pozvat (jen admin/editor/member)", () => {
    expect(
      inviteMemberSchema.safeParse({ email: "a@b.cz", role: "owner" }).success,
    ).toBe(false);
    expect(
      inviteMemberSchema.safeParse({ email: "a@b.cz", role: "admin" }).success,
    ).toBe(true);
  });
  it("odmítne neplatný e-mail", () => {
    expect(inviteMemberSchema.safeParse({ email: "neni-email" }).success).toBe(
      false,
    );
  });
});

describe("changeRoleSchema", () => {
  it("owner je platná cílová role (předání vlastnictví)", () => {
    expect(
      changeRoleSchema.safeParse({ userId: "u1", role: "owner" }).success,
    ).toBe(true);
  });
  it("vyžaduje userId", () => {
    expect(
      changeRoleSchema.safeParse({ userId: "", role: "admin" }).success,
    ).toBe(false);
  });
});
