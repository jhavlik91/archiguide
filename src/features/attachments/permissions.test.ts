import { describe, expect, it } from "vitest";
import { type Actor, VISITOR } from "@/lib/permissions";
import { canAccessAttachment, canManageAttachment } from "./permissions";

const owner: Actor = {
  kind: "user",
  userId: "owner-1",
  roles: ["client"],
  activeContext: "client",
};
const stranger: Actor = {
  kind: "user",
  userId: "stranger-1",
  roles: ["professional"],
  activeContext: "professional",
};

describe("canAccessAttachment (přes registrovanou permission)", () => {
  it("respektuje viditelnost a účastnictví", () => {
    expect(
      canAccessAttachment(owner, {
        ownerUserId: "owner-1",
        visibility: "private",
        isParticipant: false,
      }),
    ).toBe(true);
    expect(
      canAccessAttachment(stranger, {
        ownerUserId: "owner-1",
        visibility: "shared_in_context",
        isParticipant: true,
      }),
    ).toBe(true);
    expect(
      canAccessAttachment(VISITOR, {
        ownerUserId: "owner-1",
        visibility: "public",
        isParticipant: false,
      }),
    ).toBe(true);
    expect(
      canAccessAttachment(stranger, {
        ownerUserId: "owner-1",
        visibility: "private",
        isParticipant: false,
      }),
    ).toBe(false);
  });
});

describe("canManageAttachment", () => {
  it("spravuje jen vlastník", () => {
    expect(canManageAttachment(owner, { ownerUserId: "owner-1" })).toBe(true);
    expect(canManageAttachment(stranger, { ownerUserId: "owner-1" })).toBe(
      false,
    );
    expect(canManageAttachment(VISITOR, { ownerUserId: "owner-1" })).toBe(
      false,
    );
  });
});
