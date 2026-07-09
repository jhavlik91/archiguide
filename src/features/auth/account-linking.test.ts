import { describe, expect, it } from "vitest";
import { decideGoogleLink } from "./account-linking";

describe("decideGoogleLink", () => {
  it("bez existujícího účtu → vytvořit", () => {
    expect(decideGoogleLink(null)).toBe("create");
  });

  it("aktivní účet → propojit", () => {
    expect(decideGoogleLink({ status: "active" })).toBe("link");
  });

  it("deaktivovaný účet → reaktivovat", () => {
    expect(decideGoogleLink({ status: "deactivated" })).toBe("reactivate");
  });

  it("smazaný účet → zablokovat", () => {
    expect(decideGoogleLink({ status: "deleted" })).toBe("block");
  });
});
