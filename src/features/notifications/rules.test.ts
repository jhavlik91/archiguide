import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  eventDefinition,
  higherPriority,
  isKnownEvent,
  resolveChannels,
  wantsInApp,
} from "./rules";
import { NOTIFICATION_PRIORITIES } from "./types";

describe("isKnownEvent / eventDefinition", () => {
  it("zná typy z katalogu a odmítá neznámé", () => {
    expect(isKnownEvent("new_message")).toBe(true);
    expect(isKnownEvent("new_response")).toBe(true);
    expect(isKnownEvent("zcela_vymyslene")).toBe(false);
    expect(eventDefinition("new_message")?.priority).toBe("normal");
    expect(eventDefinition("zcela_vymyslene")).toBeNull();
  });
});

describe("buildDedupeKey", () => {
  it("explicitní klíč má přednost", () => {
    expect(
      buildDedupeKey("new_message", { type: "conversation", id: "c1" }, "explicit:1"),
    ).toBe("explicit:1");
  });

  it("odvodí klíč z typu a kontextu", () => {
    expect(buildDedupeKey("new_message", { type: "conversation", id: "c1" })).toBe(
      "new_message:conversation:c1",
    );
  });

  it("bez kontextu je klíč jen typ události", () => {
    expect(buildDedupeKey("shortlisted", null)).toBe("shortlisted");
  });

  it("prázdný explicitní klíč se ignoruje (spadne na odvození)", () => {
    expect(buildDedupeKey("shortlisted", null, "   ")).toBe("shortlisted");
  });
});

describe("resolveChannels / wantsInApp", () => {
  it("default politika z katalogu (in_app vždy; e-mail jen kde Y)", () => {
    expect(resolveChannels("new_message", null)).toContain("in_app");
    expect(resolveChannels("new_message", null)).not.toContain("email");
    expect(resolveChannels("new_response", null)).toEqual(
      expect.arrayContaining(["in_app", "email"]),
    );
  });

  it("preference může default kanál vypnout", () => {
    expect(wantsInApp("new_message", { channels: { in_app: false } })).toBe(false);
    expect(wantsInApp("new_message", null)).toBe(true);
  });

  it("per-událost přepis má přednost před globálním kanálem", () => {
    // Globálně in_app vypnuto, ale pro new_message explicitně zapnuto.
    const prefs = {
      channels: { in_app: false },
      events: { new_message: { in_app: true } },
    };
    expect(wantsInApp("new_message", prefs)).toBe(true);
    expect(wantsInApp("shortlisted", prefs)).toBe(false);
  });

  it("neznámý typ nemá žádné kanály", () => {
    expect(resolveChannels("neznamy", null)).toEqual([]);
    expect(wantsInApp("neznamy", null)).toBe(false);
  });
});

describe("higherPriority", () => {
  it("vrátí vyšší z dvou priorit (dedup nesnižuje)", () => {
    expect(higherPriority("normal", NOTIFICATION_PRIORITIES, "urgent")).toBe(
      "urgent",
    );
    expect(higherPriority("high", NOTIFICATION_PRIORITIES, "low")).toBe("high");
    expect(higherPriority("low", NOTIFICATION_PRIORITIES, "low")).toBe("low");
  });
});
