import { describe, expect, it } from "vitest";
import { type UserActor, VISITOR } from "@/lib/permissions";
import { canAccessNotification } from "./permissions";

function user(userId: string): UserActor {
  return { kind: "user", userId, roles: ["client"], activeContext: "client" };
}

describe("notifications permissions", () => {
  it("s notifikací smí nakládat jen její příjemce", () => {
    const subject = { recipientUserId: "u1" };
    expect(canAccessNotification(user("u1"), subject)).toBe(true);
    expect(canAccessNotification(user("u2"), subject)).toBe(false);
    expect(canAccessNotification(VISITOR, subject)).toBe(false);
  });
});
