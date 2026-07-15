import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  buildIdentity,
  countUnread,
  detectContactInfo,
  emailLocalPart,
  isParticipant,
  sendBlockReason,
  type UnreadMessage,
} from "./rules";

describe("isParticipant", () => {
  it("pozná účastníka a odmítne cizího", () => {
    expect(isParticipant(["a", "b"], "a")).toBe(true);
    expect(isParticipant(["a", "b"], "c")).toBe(false);
  });
});

describe("buildDedupeKey", () => {
  it("je nezávislý na pořadí účastníků (A→B == B→A)", () => {
    const ctx = { type: "request", id: "r1" };
    expect(buildDedupeKey(ctx, ["a", "b"])).toBe(buildDedupeKey(ctx, ["b", "a"]));
  });

  it("liší se kontextem", () => {
    expect(buildDedupeKey({ type: "request", id: "r1" }, ["a", "b"])).not.toBe(
      buildDedupeKey({ type: "request", id: "r2" }, ["a", "b"]),
    );
  });

  it("přímá konverzace (bez kontextu) má vlastní klíč", () => {
    expect(buildDedupeKey(null, ["a", "b"])).toBe("direct::a~b");
    expect(buildDedupeKey(null, ["a", "b"])).not.toBe(
      buildDedupeKey({ type: "profile", id: "a" }, ["a", "b"]),
    );
  });
});

describe("countUnread", () => {
  const base = (over: Partial<UnreadMessage>): UnreadMessage => ({
    senderUserId: "other",
    createdAt: new Date("2026-01-02T10:00:00Z"),
    moderationState: "visible",
    ...over,
  });

  it("počítá jen cizí viditelné zprávy novější než lastReadAt", () => {
    const messages = [
      base({ createdAt: new Date("2026-01-01T10:00:00Z") }), // před přečtením
      base({ createdAt: new Date("2026-01-03T10:00:00Z") }), // po přečtení → +1
      base({ senderUserId: "me" }), // vlastní → nepočítá
      base({ moderationState: "hidden" }), // skrytá → nepočítá
    ];
    const lastRead = new Date("2026-01-02T00:00:00Z");
    expect(countUnread(messages, "me", lastRead)).toBe(1);
  });

  it("bez lastReadAt (nikdy nečetl) počítá všechny cizí viditelné", () => {
    const messages = [base({}), base({}), base({ senderUserId: "me" })];
    expect(countUnread(messages, "me", null)).toBe(2);
  });
});

describe("sendBlockReason", () => {
  it("blokuje odeslání vůči deaktivované/suspendované/zrušené protistraně", () => {
    expect(sendBlockReason(["deactivated"])).not.toBeNull();
    expect(sendBlockReason(["suspended"])).not.toBeNull();
    expect(sendBlockReason(["deleted"])).not.toBeNull();
  });

  it("aktivní protistrana odeslání nebrání", () => {
    expect(sendBlockReason(["active"])).toBeNull();
  });
});

describe("detectContactInfo", () => {
  it("rozpozná e-mail", () => {
    expect(detectContactInfo("napiš na jan.novak@example.com")).toEqual({
      email: true,
      phone: false,
    });
  });

  it("rozpozná telefonní číslo (9+ číslic, i s mezerami a +420)", () => {
    expect(detectContactInfo("volej +420 777 123 456").phone).toBe(true);
    expect(detectContactInfo("777123456").phone).toBe(true);
  });

  it("krátká čísla (rok, částka) hint nevyvolají", () => {
    expect(detectContactInfo("rozpočet 250 000 na rok 2026").phone).toBe(false);
    expect(detectContactInfo("ok, uvidíme se v 15:30").phone).toBe(false);
  });

  it("běžný text bez kontaktu → nic", () => {
    expect(detectContactInfo("dobrý den, díky za nabídku")).toEqual({
      email: false,
      phone: false,
    });
  });
});

describe("emailLocalPart", () => {
  it("vrátí část před @", () => {
    expect(emailLocalPart("jan.novak@example.com")).toBe("jan.novak");
    expect(emailLocalPart("bezzavinace")).toBe("bezzavinace");
  });
});

describe("buildIdentity", () => {
  it("zrušený účet → placeholder bez odkazu", () => {
    const id = buildIdentity({
      userId: "u1",
      status: "deleted",
      email: "x@y.cz",
      headline: "Ateliér",
      slug: "atelier",
    });
    expect(id).toEqual({
      userId: "u1",
      label: "Zrušený účet",
      href: null,
      deleted: true,
    });
  });

  it("aktivní s titulkem a slugem → titulek + odkaz na profil", () => {
    const id = buildIdentity({
      userId: "u1",
      status: "active",
      email: "x@y.cz",
      headline: "Architekt Novák",
      slug: "novak",
    });
    expect(id.label).toBe("Architekt Novák");
    expect(id.href).toBe("/profesional/novak");
    expect(id.deleted).toBe(false);
  });

  it("bez titulku → handle z e-mailu; bez slugu → bez odkazu", () => {
    const id = buildIdentity({
      userId: "u1",
      status: "active",
      email: "jan@y.cz",
      headline: null,
      slug: null,
    });
    expect(id.label).toBe("jan");
    expect(id.href).toBeNull();
  });
});
