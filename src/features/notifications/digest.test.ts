import { describe, expect, it } from "vitest";
import { digestPeriodKey, digestWindowStart } from "./digest";

describe("digestPeriodKey", () => {
  it("denní klíč je UTC datum", () => {
    expect(digestPeriodKey("daily", new Date("2026-07-14T22:30:00Z"))).toBe(
      "2026-07-14",
    );
  });

  it("stejný den → stejný klíč bez ohledu na čas (idempotence cronu)", () => {
    const a = digestPeriodKey("daily", new Date("2026-07-14T01:00:00Z"));
    const b = digestPeriodKey("daily", new Date("2026-07-14T23:59:00Z"));
    expect(a).toBe(b);
  });

  it("týdenní klíč je ISO 8601 týden", () => {
    // 2026-07-14 je úterý v ISO týdnu 29.
    expect(digestPeriodKey("weekly", new Date("2026-07-14T12:00:00Z"))).toBe(
      "2026-W29",
    );
  });

  it("celý ISO týden (po-ne) sdílí stejný klíč", () => {
    const monday = digestPeriodKey("weekly", new Date("2026-07-13T00:00:00Z"));
    const sunday = digestPeriodKey("weekly", new Date("2026-07-19T23:59:00Z"));
    expect(monday).toBe(sunday);
  });

  it("přelom roku počítá týden podle ISO pravidel, ne kalendářního roku", () => {
    // 2025-12-31 (středa) patří do ISO týdne 1/2026.
    expect(digestPeriodKey("weekly", new Date("2025-12-31T12:00:00Z"))).toBe(
      "2026-W01",
    );
  });
});

describe("digestWindowStart", () => {
  it("denní okno je 24 hodin zpět", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(digestWindowStart("daily", now).toISOString()).toBe(
      "2026-07-13T12:00:00.000Z",
    );
  });

  it("týdenní okno je 7 dní zpět", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(digestWindowStart("weekly", now).toISOString()).toBe(
      "2026-07-07T12:00:00.000Z",
    );
  });
});
