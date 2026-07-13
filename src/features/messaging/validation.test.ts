import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_LENGTH } from "./types";
import {
  sendMessageSchema,
  startConversationSchema,
} from "./validation";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("sendMessageSchema", () => {
  it("přijme validní zprávu a ořízne bílé znaky", () => {
    const r = sendMessageSchema.safeParse({
      conversationId: "c1",
      content: "  ahoj  ",
      clientToken: uuid,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe("ahoj");
  });

  it("odmítne prázdný obsah", () => {
    const r = sendMessageSchema.safeParse({
      conversationId: "c1",
      content: "   ",
      clientToken: uuid,
    });
    expect(r.success).toBe(false);
  });

  it("odmítne obsah nad limit délky", () => {
    const r = sendMessageSchema.safeParse({
      conversationId: "c1",
      content: "x".repeat(MESSAGE_MAX_LENGTH + 1),
      clientToken: uuid,
    });
    expect(r.success).toBe(false);
  });

  it("odmítne neplatný clientToken (ne-UUID)", () => {
    const r = sendMessageSchema.safeParse({
      conversationId: "c1",
      content: "ahoj",
      clientToken: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});

describe("startConversationSchema", () => {
  it("přijme přímou konverzaci bez kontextu", () => {
    const r = startConversationSchema.safeParse({ recipientUserId: "u2" });
    expect(r.success).toBe(true);
  });

  it("přijme kompletní kontext (typ + ID)", () => {
    const r = startConversationSchema.safeParse({
      recipientUserId: "u2",
      contextType: "request",
      contextId: "r1",
    });
    expect(r.success).toBe(true);
  });

  it("odmítne půlku kontextu (jen typ nebo jen ID)", () => {
    expect(
      startConversationSchema.safeParse({
        recipientUserId: "u2",
        contextType: "request",
      }).success,
    ).toBe(false);
    expect(
      startConversationSchema.safeParse({
        recipientUserId: "u2",
        contextId: "r1",
      }).success,
    ).toBe(false);
  });
});
