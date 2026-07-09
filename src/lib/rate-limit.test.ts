import { beforeEach, describe, expect, it } from "vitest";
import { __clearRateLimitStore, rateLimit, resetRateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __clearRateLimitStore());

  it("povolí přesně `limit` pokusů a další zablokuje", () => {
    const key = "login:1.2.3.4";
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000, 1000).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("po uplynutí okna se limit uvolní", () => {
    const key = "reset:9.9.9.9";
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000, 1000);
    expect(rateLimit(key, 5, 60_000, 1000).allowed).toBe(false);
    // O 61 s později je okno prázdné.
    expect(rateLimit(key, 5, 60_000, 62_000).allowed).toBe(true);
  });

  it("různé klíče se počítají nezávisle", () => {
    for (let i = 0; i < 5; i++) rateLimit("login:a", 5, 60_000, 1000);
    expect(rateLimit("login:b", 5, 60_000, 1000).allowed).toBe(true);
  });

  it("resetRateLimit vynuluje počítadlo klíče", () => {
    const key = "login:reset-me";
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000, 1000);
    resetRateLimit(key);
    expect(rateLimit(key, 5, 60_000, 1000).allowed).toBe(true);
  });
});
