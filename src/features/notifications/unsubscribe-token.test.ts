import { beforeEach, describe, expect, it } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

describe("unsubscribe token", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-0123456789abcdef";
  });

  it("kulatá cesta: vytvořený token se ověří na stejný payload", () => {
    const token = createUnsubscribeToken("user-1", "marketplace");
    expect(verifyUnsubscribeToken(token)).toEqual({
      userId: "user-1",
      target: "marketplace",
    });
  });

  it("podporuje sentinel 'digest' pro odkaz z periodického souhrnu", () => {
    const token = createUnsubscribeToken("user-1", "digest");
    expect(verifyUnsubscribeToken(token)).toEqual({
      userId: "user-1",
      target: "digest",
    });
  });

  it("token je opakovaně použitelný (žádné vypršení/spotřebování)", () => {
    const token = createUnsubscribeToken("user-1", "messaging");
    expect(verifyUnsubscribeToken(token)).not.toBeNull();
    expect(verifyUnsubscribeToken(token)).not.toBeNull();
  });

  it("odmítne token podepsaný jiným tajemstvím", () => {
    const token = createUnsubscribeToken("user-1", "marketplace");
    process.env.AUTH_SECRET = "jine-tajemstvi";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("odmítne pozměněný payload (jiný uživatel/skupina)", () => {
    const token = createUnsubscribeToken("user-1", "marketplace");
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from("user-2.marketplace", "utf8").toString(
      "base64url",
    );
    expect(verifyUnsubscribeToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("odmítne neznámou skupinu a nesmyslný token", () => {
    const payload = Buffer.from("user-1.neexistujici", "utf8").toString(
      "base64url",
    );
    expect(verifyUnsubscribeToken(`${payload}.badsig`)).toBeNull();
    expect(verifyUnsubscribeToken("not-a-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});
