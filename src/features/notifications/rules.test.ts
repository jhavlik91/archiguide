import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  emailFrequency,
  eventDefinition,
  eventGroup,
  groupDefaultChannels,
  higherPriority,
  isKnownEvent,
  resolveChannels,
  wantsEmail,
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

describe("eventGroup", () => {
  it("vrátí skupinu z katalogu, neznámý typ null", () => {
    expect(eventGroup("new_message")).toBe("messaging");
    expect(eventGroup("verification_approved")).toBe("verification");
    expect(eventGroup("neznamy")).toBeNull();
  });
});

describe("resolveChannels — skupina (T033)", () => {
  it("preference na skupině vypne kanál pro všechny události skupiny", () => {
    const prefs = { groups: { marketplace: { email: false } } };
    expect(resolveChannels("new_response", prefs)).not.toContain("email");
    expect(resolveChannels("response_accepted", prefs)).not.toContain("email");
  });

  it("per-událost přepis má přednost před skupinou", () => {
    const prefs = {
      groups: { marketplace: { email: false } },
      events: { new_response: { email: true } },
    };
    expect(resolveChannels("new_response", prefs)).toContain("email");
    // Jiná událost stejné skupiny zůstává vypnutá skupinovým přepisem.
    expect(resolveChannels("response_accepted", prefs)).not.toContain("email");
  });

  it("skupina má přednost před globálním kanálem", () => {
    const prefs = {
      channels: { email: false },
      groups: { marketplace: { email: true } },
    };
    expect(resolveChannels("new_response", prefs)).toContain("email");
    expect(resolveChannels("verification_pending", prefs)).not.toContain("email");
  });

  it("kritická servisní událost má in-app vždy, i při pokusu vypnout skupinou/globálně", () => {
    const prefs = {
      channels: { in_app: false },
      groups: { verification: { in_app: false } },
      events: { verification_approved: { in_app: false } },
    };
    expect(resolveChannels("verification_approved", prefs)).toContain("in_app");
    // Nekritická událost té samé skupiny se normálně vypne.
    expect(resolveChannels("verification_pending", prefs)).not.toContain("in_app");
  });
});

describe("groupDefaultChannels", () => {
  it("messaging nemá e-mail v žádném defaultu skupiny (jen opt-in)", () => {
    expect(groupDefaultChannels("messaging")).toEqual(["in_app"]);
  });

  it("marketplace má e-mail, protože ho má aspoň jedna událost skupiny", () => {
    const channels = groupDefaultChannels("marketplace");
    expect(channels).toEqual(expect.arrayContaining(["in_app", "email"]));
  });

  it("verification má e-mail (kritické servisní stavy)", () => {
    expect(groupDefaultChannels("verification")).toEqual(
      expect.arrayContaining(["in_app", "email"]),
    );
  });
});

describe("wantsEmail / emailFrequency", () => {
  it("wantsEmail respektuje resolveChannels", () => {
    expect(wantsEmail("new_response", null)).toBe(true);
    expect(wantsEmail("new_message", null)).toBe(false);
  });

  it("emailFrequency defaultuje na immediate", () => {
    expect(emailFrequency(null)).toBe("immediate");
    expect(emailFrequency({ emailFrequency: "weekly" })).toBe("weekly");
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
