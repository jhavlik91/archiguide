import { afterEach, describe, expect, it } from "vitest";
import {
  __clearUsageResolvers,
  collectUsages,
  isUsedInPublished,
  registerMediaUsageResolver,
} from "./usage";

afterEach(() => __clearUsageResolvers());

describe("usage seam", () => {
  it("bez registrovaného konzumenta je asset nikde nepoužitý", async () => {
    expect(await collectUsages("a1")).toEqual([]);
    expect(await isUsedInPublished("a1")).toBe(false);
  });

  it("sčítá použití napříč konzumenty", async () => {
    registerMediaUsageResolver(async () => [
      { label: "Portfolio: Vila", published: true },
    ]);
    registerMediaUsageResolver(async () => [
      { label: "Profil: fotka", published: false },
    ]);
    expect(await collectUsages("a1")).toHaveLength(2);
    expect(await isUsedInPublished("a1")).toBe(true);
  });

  it("odhlášení resolveru ho přestane počítat", async () => {
    const off = registerMediaUsageResolver(async () => [
      { label: "X", published: true },
    ]);
    expect(await isUsedInPublished("a1")).toBe(true);
    off();
    expect(await isUsedInPublished("a1")).toBe(false);
  });
});
