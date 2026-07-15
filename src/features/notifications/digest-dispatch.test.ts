import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Unit testy digest dispatche (T033 § Main flow bod 4–5, § Edge cases).
 * DB, transport, verifikace a analytika jsou zmockované — testujeme rozhodovací
 * logiku (prázdný digest, neověřený e-mail, idempotence, selhání), ne DB/síť.
 */

function prismaError(code: "P2002"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("simulace DB", {
    code,
    clientVersion: "test",
  });
}

let notificationCounts: { responses: number; recommendations: number; unread: number };
let userEmail: string | null;
let verifiedEmail: boolean;
let createDeliveryError: Prisma.PrismaClientKnownRequestError | null;
let sendResult: { status: "sent" } | { status: "failed"; error: string };

const createDeliverySpy = vi.fn();
const updateDeliverySpy = vi.fn();
const sendEmailSpy = vi.fn();
const trackSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      count: vi.fn(({ where }: { where: { eventType?: unknown; state?: string } }) => {
        // Rozliší tři dotazy podle tvaru `where` sestaveného v computeDigestStats.
        if (where.state === "unread") return Promise.resolve(notificationCounts.unread);
        const inList = (where.eventType as { in: string[] })?.in ?? [];
        if (inList.includes("new_response")) return Promise.resolve(notificationCounts.responses);
        return Promise.resolve(notificationCounts.recommendations);
      }),
    },
    user: {
      findUnique: vi.fn(() =>
        Promise.resolve(userEmail ? { email: userEmail } : null),
      ),
    },
    notificationEmailDelivery: {
      create: vi.fn((args: unknown) => {
        createDeliverySpy(args);
        if (createDeliveryError) return Promise.reject(createDeliveryError);
        return Promise.resolve({ id: "delivery-1" });
      }),
      update: vi.fn((args: unknown) => {
        updateDeliverySpy(args);
        return Promise.resolve({});
      }),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ host: "app.test" })),
}));

vi.mock("@/lib/email/transport", () => ({
  sendEmail: (...a: unknown[]) => {
    sendEmailSpy(...a);
    return Promise.resolve(sendResult);
  },
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: (...a: unknown[]) => trackSpy(...a) }));

vi.mock("@/features/verification/service", () => ({
  getVerifiedTypes: () => Promise.resolve(verifiedEmail ? ["email"] : []),
}));

import { dispatchDigestForUser } from "./digest-dispatch";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-0123456789abcdef";
  notificationCounts = { responses: 0, recommendations: 0, unread: 0 };
  userEmail = "owner@example.cz";
  verifiedEmail = true;
  createDeliveryError = null;
  sendResult = { status: "sent" };
});

afterEach(() => {
  createDeliverySpy.mockClear();
  updateDeliverySpy.mockClear();
  sendEmailSpy.mockClear();
  trackSpy.mockClear();
});

const now = new Date("2026-07-14T12:00:00Z");

describe("dispatchDigestForUser — prázdný digest", () => {
  it("bez žádné aktivity se e-mail neposílá (T033 § Edge cases)", async () => {
    const outcome = await dispatchDigestForUser("u1", "daily", now);
    expect(outcome).toBe("empty");
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(createDeliverySpy).not.toHaveBeenCalled();
  });
});

describe("dispatchDigestForUser — ověření e-mailu (T011)", () => {
  it("neověřený e-mail → skip bez odeslání", async () => {
    notificationCounts.responses = 2;
    verifiedEmail = false;
    const outcome = await dispatchDigestForUser("u1", "daily", now);
    expect(outcome).toBe("skipped");
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });
});

describe("dispatchDigestForUser — úspěšné odeslání", () => {
  it("nenulová aktivita + ověřený e-mail → sent, delivery řádek queued→sent", async () => {
    notificationCounts = { responses: 3, recommendations: 1, unread: 0 };
    const outcome = await dispatchDigestForUser("u1", "weekly", now);
    expect(outcome).toBe("sent");
    expect(createDeliverySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: "u1",
          kind: "weekly_digest",
          status: "queued",
          periodKey: "2026-W29",
        }),
      }),
    );
    expect(updateDeliverySpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
    expect(trackSpy).toHaveBeenCalledWith("digest_sent", { frequency: "weekly" });
  });
});

describe("dispatchDigestForUser — idempotence duplicitního běhu", () => {
  it("kolize unikátního indexu (P2002) → already_sent, žádný e-mail", async () => {
    notificationCounts.responses = 1;
    createDeliveryError = prismaError("P2002");
    const outcome = await dispatchDigestForUser("u1", "daily", now);
    expect(outcome).toBe("already_sent");
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });
});

describe("dispatchDigestForUser — selhání providera", () => {
  it("sendEmail selže → failed, delivery řádek se aktualizuje na failed", async () => {
    notificationCounts.responses = 1;
    sendResult = { status: "failed", error: "provider down" };
    const outcome = await dispatchDigestForUser("u1", "daily", now);
    expect(outcome).toBe("failed");
    expect(updateDeliverySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", error: "provider down" }),
      }),
    );
  });
});
