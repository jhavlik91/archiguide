import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefContent } from "./types";

/**
 * Integrační test datové vrstvy briefu (T022) nad in-memory mockem DB. Pokrývá
 * invarianty sdílení a editace:
 *  - sdílení zmrazí snapshot, nastaví token + `shared`; opětovné sdílení beze
 *    změny je no-op (stejný odkaz),
 *  - editace sdíleného briefu ho posune `shared → revised`; opětovné sdílení
 *    obnoví snapshot (`revised → shared`),
 *  - odvolání token vynuluje → token přestane fungovat okamžitě,
 *  - sdílený snapshot je redigovaný (bez přesné adresy),
 *  - archivovat lze jen draft.
 */

type Row = {
  id: string;
  ownerUserId: string;
  guideSessionId: string | null;
  scenarioSlug: string;
  title: string;
  content: unknown;
  status: string;
  visibility: string;
  shareToken: string | null;
  sharedContent: unknown;
  sharedTitle: string | null;
  sharedAt: Date | null;
  shareRevokedAt: Date | null;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

let rows: Row[] = [];

// Service táhne přes fasádu příloh `@/lib/session` (→ next-auth); v unit testu ho
// zaslepíme, ať se nezavádí celý auth řetězec (testujeme jen datovou vrstvu).
vi.mock("@/lib/session", () => ({
  getActor: () => Promise.resolve({ kind: "visitor" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    brief: {
      findUnique: ({
        where,
      }: {
        where: { id?: string; shareToken?: string };
      }) =>
        Promise.resolve(
          rows.find((r) =>
            where.id !== undefined
              ? r.id === where.id
              : where.shareToken != null && r.shareToken === where.shareToken,
          ) ?? null,
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        row.updatedAt = new Date();
        return Promise.resolve(row);
      },
    },
  },
}));

import {
  archiveBrief,
  getBriefBySharedToken,
  shareBrief,
  revokeShare,
  updateBriefContent,
} from "./service";
import type { BriefEditInput } from "./content";

function content(overrides: Partial<BriefContent> = {}): BriefContent {
  return {
    version: 1,
    summary: "Shrnutí",
    goal: "Cíl",
    projectType: "Rekonstrukce",
    currentState: null,
    scope: null,
    location: { display: "Praha", address: "Dlouhá 5", shareAddress: false },
    budget: { known: false, display: "Rozpočet neuveden" },
    timing: null,
    inputs: { count: 0, mediaIds: [] },
    missingInputs: [],
    preferences: [],
    risks: [],
    recommendedProfessions: [],
    nextStep: null,
    ...overrides,
  };
}

function seed(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: `b_${rows.length + 1}`,
    ownerUserId: "u1",
    guideSessionId: null,
    scenarioSlug: "konzultace",
    title: "Můj brief",
    content: content(),
    status: "draft",
    visibility: "private",
    shareToken: null,
    sharedContent: null,
    sharedTitle: null,
    sharedAt: null,
    shareRevokedAt: null,
    generatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  rows.push(row);
  return row;
}

function editInput(overrides: Partial<BriefEditInput> = {}): BriefEditInput {
  return {
    title: "Můj brief",
    summary: "Shrnutí",
    goal: "Cíl",
    projectType: "Rekonstrukce",
    currentState: null,
    scope: null,
    location: { display: "Praha", address: "Dlouhá 5", shareAddress: false },
    budget: { known: false, display: "" },
    timing: null,
    preferences: [],
    risks: [],
    recommendedProfessions: [],
    nextStep: null,
    ...overrides,
  };
}

beforeEach(() => {
  rows = [];
});
afterEach(() => vi.clearAllMocks());

describe("shareBrief", () => {
  it("z draftu vytvoří token, zmrazí snapshot a nastaví shared/shared_link", async () => {
    const b = seed();
    const res = await shareBrief(b.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.token).toBeTruthy();
    expect(res.reshared).toBe(false);
    expect(b.status).toBe("shared");
    expect(b.visibility).toBe("shared_link");
    expect(b.sharedContent).not.toBeNull();
    expect(b.sharedAt).not.toBeNull();
  });

  it("opětovné sdílení beze změny je no-op (stejný token)", async () => {
    const b = seed();
    const first = await shareBrief(b.id);
    const second = await shareBrief(b.id);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.token).toBe(first.token);
    expect(second.reshared).toBe(false);
  });

  it("archivovaný brief nelze sdílet", async () => {
    const b = seed({ status: "archived" });
    const res = await shareBrief(b.id);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_shareable");
  });
});

describe("editace po sdílení → revised → znovu shared", () => {
  it("editace sdíleného briefu ho posune na revised", async () => {
    const b = seed();
    await shareBrief(b.id);
    const res = await updateBriefContent(b.id, editInput({ summary: "Nové" }));
    expect(res.ok).toBe(true);
    expect(b.status).toBe("revised");
  });

  it("opětovné sdílení revidovaného briefu obnoví snapshot a vrátí do shared", async () => {
    const b = seed();
    await shareBrief(b.id);
    await updateBriefContent(b.id, editInput({ summary: "Nové shrnutí" }));
    const res = await shareBrief(b.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.reshared).toBe(true);
    expect(b.status).toBe("shared");
    // Snapshot teď nese upravené shrnutí.
    expect((b.sharedContent as BriefContent).summary).toBe("Nové shrnutí");
  });
});

describe("revokeShare", () => {
  it("odvolá token → sdílená stránka ho už nenajde", async () => {
    const b = seed();
    const shared = await shareBrief(b.id);
    expect(shared.ok).toBe(true);
    if (!shared.ok) return;

    // Token funguje.
    expect(await getBriefBySharedToken(shared.token)).not.toBeNull();

    const revoked = await revokeShare(b.id);
    expect(revoked.ok).toBe(true);
    expect(b.shareToken).toBeNull();
    expect(b.status).toBe("ready");
    // Token okamžitě přestane fungovat.
    expect(await getBriefBySharedToken(shared.token)).toBeNull();
  });

  it("nesdílený brief nemá co odvolat", async () => {
    const b = seed();
    const res = await revokeShare(b.id);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_shared");
  });
});

describe("getBriefBySharedToken", () => {
  it("vydá redigovaný snapshot bez přesné adresy", async () => {
    const b = seed();
    const shared = await shareBrief(b.id);
    if (!shared.ok) return;
    const view = await getBriefBySharedToken(shared.token);
    expect(view).not.toBeNull();
    expect(view?.content.location).toEqual({
      display: "Praha",
      shareAddress: false,
    });
    expect(view?.content.location).not.toHaveProperty("address");
  });

  it("neznámý token → null", async () => {
    expect(await getBriefBySharedToken("nope")).toBeNull();
    expect(await getBriefBySharedToken("")).toBeNull();
  });
});

describe("archiveBrief", () => {
  it("archivuje draft", async () => {
    const b = seed();
    const res = await archiveBrief(b.id);
    expect(res.ok).toBe(true);
    expect(b.status).toBe("archived");
  });

  it("shared brief nelze archivovat (mimo graf §2)", async () => {
    const b = seed();
    await shareBrief(b.id);
    const res = await archiveBrief(b.id);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("invalid_transition");
  });
});
