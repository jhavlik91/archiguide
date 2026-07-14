import { describe, expect, it } from "vitest";
import {
  canTransition,
  isArchivableFrom,
  isShareableFrom,
  statusAfterEdit,
} from "./transitions";
import { BRIEF_STATUSES } from "./types";

/**
 * Stavový automat briefu (T022) — přechody přesně dle zadani/08 §2. Neplatné
 * přechody musí být odmítnuté (server je pak nepustí dál).
 */

describe("canTransition", () => {
  it("povoluje jen hrany z grafu §2", () => {
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("draft", "archived")).toBe(true);
    expect(canTransition("ready", "shared")).toBe(true);
    expect(canTransition("shared", "revised")).toBe(true);
    expect(canTransition("revised", "shared")).toBe(true);
  });

  it("odmítá přechody mimo graf", () => {
    expect(canTransition("draft", "shared")).toBe(false);
    expect(canTransition("ready", "archived")).toBe(false);
    expect(canTransition("shared", "archived")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(false);
    expect(canTransition("revised", "archived")).toBe(false);
  });

  it("identita (no-op) je povolená pro každý stav", () => {
    for (const s of BRIEF_STATUSES) expect(canTransition(s, s)).toBe(true);
  });
});

describe("isShareableFrom", () => {
  it("sdílet lze z draft/ready/revised, ne z shared/archived", () => {
    expect(isShareableFrom("draft")).toBe(true);
    expect(isShareableFrom("ready")).toBe(true);
    expect(isShareableFrom("revised")).toBe(true);
    expect(isShareableFrom("shared")).toBe(false);
    expect(isShareableFrom("archived")).toBe(false);
  });
});

describe("statusAfterEdit", () => {
  it("editace sdíleného briefu ho posune na revised", () => {
    expect(statusAfterEdit("shared")).toBe("revised");
  });
  it("v ostatních stavech editace stav nemění", () => {
    expect(statusAfterEdit("draft")).toBe("draft");
    expect(statusAfterEdit("ready")).toBe("ready");
    expect(statusAfterEdit("revised")).toBe("revised");
    expect(statusAfterEdit("archived")).toBe("archived");
  });
});

describe("isArchivableFrom", () => {
  it("archivovat lze jen z draftu", () => {
    expect(isArchivableFrom("draft")).toBe(true);
    expect(isArchivableFrom("ready")).toBe(false);
    expect(isArchivableFrom("shared")).toBe(false);
  });
});
