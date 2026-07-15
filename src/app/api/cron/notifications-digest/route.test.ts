import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit testy cron endpointu digestu (T033 § Main flow bod 5). Ověřují
 * autorizaci (sdílené tajemství) a validaci `frequency` — dispatch samotný
 * testuje `digest-dispatch.test.ts`.
 */

type DigestOutcome = "sent" | "empty" | "skipped" | "already_sent" | "failed";

const listSpy = vi.fn().mockResolvedValue([] as string[]);
const dispatchSpy = vi
  .fn<(...args: unknown[]) => Promise<DigestOutcome>>()
  .mockResolvedValue("sent");

vi.mock("@/features/notifications/digest-dispatch", () => ({
  listDigestRecipientIds: (...a: unknown[]) => listSpy(...a),
  dispatchDigestForUser: (...a: unknown[]) => dispatchSpy(...a),
}));

import { POST } from "./route";

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  listSpy.mockClear();
  dispatchSpy.mockClear();
  delete process.env.CRON_SECRET;
});

function request(url: string, authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request(url, { method: "POST", headers });
}

describe("POST /api/cron/notifications-digest — autorizace", () => {
  it("bez hlavičky → 401, žádný dispatch", async () => {
    const res = await POST(
      request("https://app.test/api/cron/notifications-digest?frequency=daily"),
    );
    expect(res.status).toBe(401);
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("špatné tajemství → 401", async () => {
    const res = await POST(
      request(
        "https://app.test/api/cron/notifications-digest?frequency=daily",
        "Bearer spatne-heslo",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("bez nakonfigurovaného CRON_SECRET → vždy 401 (i se správnou hlavičkou)", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      request(
        "https://app.test/api/cron/notifications-digest?frequency=daily",
        "Bearer cokoliv",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("správné tajemství → projde autorizací", async () => {
    const res = await POST(
      request(
        "https://app.test/api/cron/notifications-digest?frequency=daily",
        "Bearer test-cron-secret",
      ),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/cron/notifications-digest — frequency", () => {
  it("chybějící/neplatná frequency → 400", async () => {
    const res = await POST(
      request(
        "https://app.test/api/cron/notifications-digest",
        "Bearer test-cron-secret",
      ),
    );
    expect(res.status).toBe(400);

    const resBad = await POST(
      request(
        "https://app.test/api/cron/notifications-digest?frequency=monthly",
        "Bearer test-cron-secret",
      ),
    );
    expect(resBad.status).toBe(400);
  });
});

describe("POST /api/cron/notifications-digest — dispatch", () => {
  it("iteruje kandidáty a sečte výsledky do summary", async () => {
    listSpy.mockResolvedValueOnce(["u1", "u2", "u3"]);
    dispatchSpy
      .mockResolvedValueOnce("sent")
      .mockResolvedValueOnce("empty")
      .mockResolvedValueOnce("sent");

    const res = await POST(
      request(
        "https://app.test/api/cron/notifications-digest?frequency=weekly",
        "Bearer test-cron-secret",
      ),
    );
    const body = await res.json();
    expect(body).toMatchObject({
      frequency: "weekly",
      candidates: 3,
      sent: 2,
      empty: 1,
      skipped: 0,
      already_sent: 0,
      failed: 0,
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(3);
  });
});
