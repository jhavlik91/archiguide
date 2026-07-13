import { describe, expect, it } from "vitest";
import { type UserActor, VISITOR } from "@/lib/permissions";
import {
  canAccessConversation,
  canSendToConversation,
  canStartConversation,
} from "./permissions";

function user(userId: string): UserActor {
  return { kind: "user", userId, roles: ["client"], activeContext: "client" };
}

const subject = { participantUserIds: ["a", "b"] };

describe("messaging permissions", () => {
  it("konverzaci smí číst jen účastník", () => {
    expect(canAccessConversation(user("a"), subject)).toBe(true);
    expect(canAccessConversation(user("b"), subject)).toBe(true);
    expect(canAccessConversation(user("c"), subject)).toBe(false);
    expect(canAccessConversation(VISITOR, subject)).toBe(false);
  });

  it("psát smí jen účastník (návštěvník ani cizí ne)", () => {
    expect(canSendToConversation(user("a"), subject)).toBe(true);
    expect(canSendToConversation(user("c"), subject)).toBe(false);
    expect(canSendToConversation(VISITOR, subject)).toBe(false);
  });

  it("zahájit konverzaci smí kterýkoli přihlášený, návštěvník ne", () => {
    expect(canStartConversation(user("a"))).toBe(true);
    expect(canStartConversation(VISITOR)).toBe(false);
  });
});
