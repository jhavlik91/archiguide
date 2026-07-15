import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefContent } from "@/features/brief/types";

/**
 * Integrační test datové vrstvy viditelnosti/anonymizace (T025) nad in-memory
 * mockem DB (stejný princip jako `brief/service.test.ts`). Pokrývá:
 *  - `setRequestVisibility` mění jen `visibility`,
 *  - `getPublicRequestView` vrací DTO BEZ `ownerUserId` a s redigovaným briefem,
 *  - pozvánky (`RequestInvite`) jsou idempotentní a řídí `isUserInvitedToRequest`.
 */

type RequestRow = {
  id: string;
  ownerUserId: string;
  briefId: string | null;
  type: string;
  visibility: string;
  status: string;
  title: string;
  targetProfessionSlugs: string[];
  region: string;
  budget: string | null;
  timeline: string | null;
  deadline: Date | null;
  briefSnapshot: unknown;
  publishedAt: Date | null;
  editedAfterPublish: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type InviteRow = {
  id: string;
  requestId: string;
  invitedUserId: string;
  invitedByUserId: string | null;
  createdAt: Date;
};

let requestRows: RequestRow[] = [];
let inviteRows: InviteRow[] = [];

vi.mock("@/lib/session", () => ({
  getActor: () => Promise.resolve({ kind: "visitor" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    request: {
      findUnique: ({
        where,
        select,
      }: {
        where: { id: string };
        select?: Record<string, boolean>;
      }) => {
        const row = requestRows.find((r) => r.id === where.id) ?? null;
        if (!row) return Promise.resolve(null);
        if (!select) return Promise.resolve(row);
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          projected[key] = (row as unknown as Record<string, unknown>)[key];
        }
        return Promise.resolve(projected);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<RequestRow>;
      }) => {
        const row = requestRows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        row.updatedAt = new Date();
        return Promise.resolve(row);
      },
    },
    requestInvite: {
      findUnique: ({
        where,
      }: {
        where: {
          requestId_invitedUserId: { requestId: string; invitedUserId: string };
        };
      }) => {
        const { requestId, invitedUserId } = where.requestId_invitedUserId;
        const row =
          inviteRows.find(
            (r) =>
              r.requestId === requestId && r.invitedUserId === invitedUserId,
          ) ?? null;
        return Promise.resolve(row);
      },
      upsert: ({
        where,
        create,
      }: {
        where: {
          requestId_invitedUserId: { requestId: string; invitedUserId: string };
        };
        create: Omit<InviteRow, "id" | "createdAt">;
      }) => {
        const { requestId, invitedUserId } = where.requestId_invitedUserId;
        const existing = inviteRows.find(
          (r) => r.requestId === requestId && r.invitedUserId === invitedUserId,
        );
        if (existing) return Promise.resolve(existing);
        const row: InviteRow = {
          id: `inv_${inviteRows.length + 1}`,
          createdAt: new Date(),
          ...create,
        };
        inviteRows.push(row);
        return Promise.resolve(row);
      },
    },
  },
}));

import {
  getPublicRequestView,
  inviteProfessionalToRequest,
  isUserInvitedToRequest,
  setRequestVisibility,
} from "./service";

function briefContent(overrides: Partial<BriefContent> = {}): BriefContent {
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

function seedRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  const row: RequestRow = {
    id: `r_${requestRows.length + 1}`,
    ownerUserId: "u-owner",
    briefId: "b1",
    type: "b2c",
    visibility: "private",
    status: "active",
    title: "Rekonstrukce bytu",
    targetProfessionSlugs: ["architekt"],
    region: "Praha",
    budget: null,
    timeline: null,
    deadline: null,
    briefSnapshot: null,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    editedAfterPublish: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  requestRows.push(row);
  return row;
}

beforeEach(() => {
  requestRows = [];
  inviteRows = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("setRequestVisibility", () => {
  it("mění jen visibility, ostatní pole beze změny", async () => {
    const row = seedRequest({ visibility: "private" });
    const result = await setRequestVisibility(row.id, "public");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view.visibility).toBe("public");
      expect(result.view.title).toBe(row.title);
    }
  });

  it("not_found pro neexistující poptávku", async () => {
    const result = await setRequestVisibility("missing", "public");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("getPublicRequestView", () => {
  it("vrací DTO BEZ ownerUserId a s redigovaným briefem", async () => {
    const row = seedRequest({
      briefSnapshot: briefContent() as unknown,
    });
    const result = await getPublicRequestView(row.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view).not.toHaveProperty("ownerUserId");
      expect(result.view.briefPreview?.location?.address).toBeUndefined();
      expect(result.view.briefPreview?.location?.display).toBe("Praha");
    }
  });

  it("draft bez briefSnapshotu → briefPreview null", async () => {
    const row = seedRequest({ status: "draft", publishedAt: null });
    const result = await getPublicRequestView(row.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.view.briefPreview).toBeNull();
  });

  it("not_found pro neexistující poptávku", async () => {
    const result = await getPublicRequestView("missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("pozvánky (RequestInvite)", () => {
  it("isUserInvitedToRequest false bez pozvánky, true po pozvání", async () => {
    const row = seedRequest();
    expect(await isUserInvitedToRequest(row.id, "u-pro")).toBe(false);

    await inviteProfessionalToRequest({
      requestId: row.id,
      invitedUserId: "u-pro",
      invitedByUserId: row.ownerUserId,
    });
    expect(await isUserInvitedToRequest(row.id, "u-pro")).toBe(true);
  });

  it("opětovné pozvání téhož kandidáta je idempotentní", async () => {
    const row = seedRequest();
    const first = await inviteProfessionalToRequest({
      requestId: row.id,
      invitedUserId: "u-pro",
      invitedByUserId: row.ownerUserId,
    });
    const second = await inviteProfessionalToRequest({
      requestId: row.id,
      invitedUserId: "u-pro",
      invitedByUserId: row.ownerUserId,
    });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(inviteRows).toHaveLength(1);
  });

  it("not_found pro neexistující poptávku", async () => {
    const result = await inviteProfessionalToRequest({
      requestId: "missing",
      invitedUserId: "u-pro",
      invitedByUserId: "u-owner",
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
