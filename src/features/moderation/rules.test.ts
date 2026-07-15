import { describe, expect, it } from "vitest";
import { isMessageReportReason, isReportReason } from "./rules";
import { reportMessageSchema } from "./validation";

describe("isReportReason", () => {
  it("přijme důvod z enumu, odmítne cizí", () => {
    expect(isReportReason("harassment")).toBe(true);
    expect(isReportReason("copyright")).toBe(true);
    expect(isReportReason("nesmysl")).toBe(false);
  });
});

describe("isMessageReportReason", () => {
  it("přijme jen důvody nabízené pro zprávy", () => {
    expect(isMessageReportReason("spam")).toBe(true);
    expect(isMessageReportReason("harassment")).toBe(true);
    // Platný důvod obecně, ale ne pro zprávy (patří jinému cíli).
    expect(isMessageReportReason("copyright")).toBe(false);
    expect(isMessageReportReason("fake_identity")).toBe(false);
  });
});

describe("reportMessageSchema", () => {
  it("vyžaduje messageId a důvod z enumu", () => {
    expect(reportMessageSchema.safeParse({ messageId: "m1", reason: "spam" }).success).toBe(true);
    expect(reportMessageSchema.safeParse({ messageId: "m1", reason: "xxx" }).success).toBe(false);
    expect(reportMessageSchema.safeParse({ reason: "spam" }).success).toBe(false);
  });

  it("prázdný popis normalizuje na undefined", () => {
    const parsed = reportMessageSchema.parse({
      messageId: "m1",
      reason: "spam",
      note: "   ",
    });
    expect(parsed.note).toBeUndefined();
  });

  it("popis se zachová a ořízne bílé znaky", () => {
    const parsed = reportMessageSchema.parse({
      messageId: "m1",
      reason: "scam",
      note: "  podezřelé  ",
    });
    expect(parsed.note).toBe("podezřelé");
  });
});
