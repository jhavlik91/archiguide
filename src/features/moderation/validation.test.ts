import { describe, expect, it } from "vitest";
import { moderationActionSchema, reportContentSchema } from "./validation";

describe("reportContentSchema", () => {
  it("přijme platný vstup a prázdnou poznámku převede na null", () => {
    const parsed = reportContentSchema.parse({
      targetType: "message",
      targetId: "msg-1",
      reason: "spam",
      note: "  ",
    });
    expect(parsed.note).toBeNull();
  });

  it("odmítne neplatný targetType a reason", () => {
    expect(
      reportContentSchema.safeParse({
        targetType: "invalid",
        targetId: "x",
        reason: "spam",
      }).success,
    ).toBe(false);
    expect(
      reportContentSchema.safeParse({
        targetType: "message",
        targetId: "x",
        reason: "invalid",
      }).success,
    ).toBe(false);
  });

  it("odmítne prázdné targetId", () => {
    expect(
      reportContentSchema.safeParse({
        targetType: "message",
        targetId: "",
        reason: "spam",
      }).success,
    ).toBe(false);
  });
});

describe("moderationActionSchema", () => {
  it("vyžaduje neprázdný důvod (min. délka)", () => {
    expect(
      moderationActionSchema.safeParse({
        actionType: "no_action",
        reason: "ok",
      }).success,
    ).toBe(false);
    expect(
      moderationActionSchema.safeParse({
        actionType: "no_action",
        reason: "Dostatečně dlouhý důvod.",
      }).success,
    ).toBe(true);
  });

  it("odmítne neplatný actionType", () => {
    expect(
      moderationActionSchema.safeParse({
        actionType: "delete_everything",
        reason: "Dostatečně dlouhý důvod.",
      }).success,
    ).toBe(false);
  });
});
