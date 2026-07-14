import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationPreferences } from "./types";

/**
 * Unit testy emit API (T032 § Acceptance). Ověřují jádro pravidel: deduplikace,
 * ne-notifikace vlastní akce a respektování uložených preferencí. Datová vrstva a
 * analytika jsou zmockované — testujeme rozhodovací logiku emit, ne DB.
 */

let created = true;
let prefs: NotificationPreferences = {};
let deliverable = true;
const createSpy = vi.fn();

vi.mock("./service", () => ({
  createOrBumpNotification: (input: Record<string, unknown>) => {
    createSpy(input);
    return Promise.resolve({
      notification: { id: "n1", priority: input.priority },
      created,
    });
  },
  getNotificationPreferences: () => Promise.resolve(prefs),
  recipientIsDeliverable: () => Promise.resolve(deliverable),
}));

const trackSpy = vi.fn();
vi.mock("@/lib/analytics", () => ({ trackEvent: (...a: unknown[]) => trackSpy(...a) }));

import { emit } from "./emit";

beforeEach(() => {
  created = true;
  prefs = {};
  deliverable = true;
});
afterEach(() => {
  createSpy.mockClear();
  trackSpy.mockClear();
});

const base = {
  eventType: "new_message",
  recipientUserId: "u1",
  title: "Nová zpráva",
  reason: "…",
  link: "/messages/c1",
  context: { type: "conversation", id: "c1" },
};

describe("emit — vlastní akce nenotifikuje", () => {
  it("actorUserId === recipient → skip self, žádný zápis", async () => {
    const res = await emit({ ...base, actorUserId: "u1" });
    expect(res).toEqual({ status: "skipped", reason: "self" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("actorUserId != recipient → notifikace vznikne", async () => {
    const res = await emit({ ...base, actorUserId: "u2" });
    expect(res.status).toBe("created");
    expect(createSpy).toHaveBeenCalledOnce();
  });
});

describe("emit — katalog a validace", () => {
  it("neznámý typ události → skip, žádný zápis", async () => {
    const res = await emit({ ...base, eventType: "zcela_vymyslene" });
    expect(res).toEqual({ status: "skipped", reason: "unknown_event" });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("chybějící odkaz do kontextu → skip invalid", async () => {
    const res = await emit({ ...base, link: "" });
    expect(res).toEqual({ status: "skipped", reason: "invalid" });
  });

  it("zrušený/nedoručitelný příjemce → skip undeliverable", async () => {
    deliverable = false;
    const res = await emit(base);
    expect(res).toEqual({ status: "skipped", reason: "undeliverable" });
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe("emit — preference kanálů", () => {
  it("vypnutý in-app kanál → notifikace nevznikne", async () => {
    prefs = { channels: { in_app: false } };
    const res = await emit(base);
    expect(res).toEqual({ status: "skipped", reason: "channel_off" });
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe("emit — deduplikace a analytika", () => {
  it("nová notifikace → status created + analytika notification.created", async () => {
    created = true;
    const res = await emit(base);
    expect(res.status).toBe("created");
    expect(trackSpy).toHaveBeenCalledWith(
      "notification.created",
      expect.objectContaining({ eventType: "new_message" }),
    );
  });

  it("sloučená (dedup) → status deduped, bez analytiky created", async () => {
    created = false;
    const res = await emit(base);
    expect(res.status).toBe("deduped");
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("odvodí dedup klíč z kontextu, když není explicitní", async () => {
    await emit(base);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "new_message:conversation:c1" }),
    );
  });
});
