import { afterEach, describe, expect, it } from "vitest";
import { VISITOR } from "@/lib/permissions";
import {
  __resetResolversForTests,
  hasContextResolver,
  registerContextResolver,
  resolveContext,
} from "./registry";

afterEach(() => __resetResolversForTests());

describe("registry resolverů kontextu", () => {
  it("neznámý typ kontextu je fail-closed", async () => {
    expect(hasContextResolver("brief")).toBe(false);
    expect(await resolveContext({ type: "brief", id: "b1" }, VISITOR)).toEqual({
      exists: false,
      isParticipant: false,
    });
  });

  it("registrovaný resolver rozhoduje o existenci a účastnictví", async () => {
    registerContextResolver("brief", async (id, actor) => ({
      exists: id === "b1",
      isParticipant: actor.kind === "user" && actor.userId === "u1",
    }));

    expect(hasContextResolver("brief")).toBe(true);
    expect(await resolveContext({ type: "brief", id: "b1" }, VISITOR)).toEqual({
      exists: true,
      isParticipant: false,
    });
    expect(
      await resolveContext(
        { type: "brief", id: "b1" },
        {
          kind: "user",
          userId: "u1",
          roles: ["client"],
          activeContext: "client",
        },
      ),
    ).toEqual({ exists: true, isParticipant: true });
  });

  it("přeregistrace téhož typu přepíše (HMR-safe)", async () => {
    registerContextResolver("brief", async () => ({
      exists: true,
      isParticipant: true,
    }));
    registerContextResolver("brief", async () => ({
      exists: false,
      isParticipant: false,
    }));
    expect(await resolveContext({ type: "brief", id: "x" }, VISITOR)).toEqual({
      exists: false,
      isParticipant: false,
    });
  });
});
