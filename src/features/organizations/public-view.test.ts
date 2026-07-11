import { describe, expect, it } from "vitest";
import { isOrgPubliclyVisible } from "./public-view";

describe("isOrgPubliclyVisible", () => {
  it("aktivní firma je veřejná", () => {
    expect(isOrgPubliclyVisible("active")).toBe(true);
  });

  it("archivovaná firma je skrytá (404 pro veřejnost)", () => {
    expect(isOrgPubliclyVisible("archived")).toBe(false);
  });
});
