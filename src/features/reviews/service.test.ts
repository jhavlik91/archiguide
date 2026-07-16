import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integrační test datové vrstvy hodnocení (T037) nad in-memory mockem DB
 * (stejný princip jako `responses/service.test.ts`). Pokrývá acceptance
 * kritéria:
 *  - recenzi nelze založit bez accepted interakce,
 *  - duplicitní recenze na stejnou interakci je odmítnuta,
 *  - hodnocený může odpovědět a rozporovat; disputed nese příznak,
 *  - skrytá recenze se nepočítá do průměru a není ve veřejném výpisu.
 */

type ResponseRow = {
  id: string;
  requestId: string;
  authorUserId: string | null;
  authorOrgId: string | null;
  status: string;
  updatedAt: Date;
};

type ReviewRow = {
  id: string;
  reviewerUserId: string | null;
  targetUserId: string | null;
  targetOrgId: string | null;
  evidenceResponseId: string;
  ratingCommunication: number;
  ratingQuality: number;
  ratingTimeliness: number;
  ratingTransparency: number;
  ratingProfessionalism: number;
  text: string | null;
  status: string;
  replyText: string | null;
  repliedAt: Date | null;
  disputeReason: string | null;
  disputedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

let responseRows: ResponseRow[] = [];
let reviewRows: ReviewRow[] = [];
let requestRows: { id: string; ownerUserId: string; title: string }[] = [];

const { reportContentMock } = vi.hoisted(() => ({
  reportContentMock: vi.fn(() =>
    Promise.resolve({ ok: true, reportId: "report_1", deduped: false }),
  ),
}));

vi.mock("@/lib/notifications", () => ({
  emit: vi.fn(() =>
    Promise.resolve({ status: "skipped", reason: "channel_off" }),
  ),
}));

vi.mock("@/features/moderation/service", () => ({
  reportContent: reportContentMock,
}));

function findResponseWithMeta(id: string) {
  const row = responseRows.find((r) => r.id === id) ?? null;
  if (!row) return null;
  const request = requestRows.find((r) => r.id === row.requestId) ?? null;
  const review =
    reviewRows.find((r) => r.evidenceResponseId === row.id) ?? null;
  return {
    ...row,
    request: request
      ? {
          id: request.id,
          ownerUserId: request.ownerUserId,
          title: request.title,
        }
      : null,
    review: review ? { id: review.id } : null,
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    professionalProfile: {
      findUnique: () => Promise.resolve(null),
    },
    organization: {
      findUnique: () => Promise.resolve(null),
    },
    organizationMember: {
      findMany: () => Promise.resolve([]),
    },
    requestResponse: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(findResponseWithMeta(where.id)),
      findMany: ({
        where,
      }: {
        where: {
          status: string;
          review: null;
          request: { ownerUserId: string };
        };
      }) => {
        const rows = responseRows.filter(
          (r) =>
            r.status === where.status &&
            !reviewRows.some((rv) => rv.evidenceResponseId === r.id) &&
            requestRows.find((req) => req.id === r.requestId)?.ownerUserId ===
              where.request.ownerUserId,
        );
        return Promise.resolve(
          rows.map((r) => ({
            ...r,
            request: {
              id: r.requestId,
              title: requestRows.find((req) => req.id === r.requestId)!.title,
            },
          })),
        );
      },
    },
    review: {
      findUnique: ({
        where,
      }: {
        where: { id?: string; evidenceResponseId?: string };
      }) => {
        const row = where.id
          ? (reviewRows.find((r) => r.id === where.id) ?? null)
          : (reviewRows.find(
              (r) => r.evidenceResponseId === where.evidenceResponseId,
            ) ?? null);
        return Promise.resolve(row);
      },
      findMany: ({
        where,
      }: {
        where: { targetUserId?: string; targetOrgId?: string };
      }) => {
        const rows = reviewRows.filter(
          (r) =>
            (where.targetUserId === undefined ||
              r.targetUserId === where.targetUserId) &&
            (where.targetOrgId === undefined ||
              r.targetOrgId === where.targetOrgId),
        );
        return Promise.resolve(rows);
      },
      create: ({
        data,
      }: {
        data: Partial<Omit<ReviewRow, "id" | "createdAt" | "updatedAt">>;
      }) => {
        // Prisma defaultuje nezadané nullable sloupce na `null` — mock to
        // musí napodobit, jinak `undefined !== null` kazí kontrolní logiku
        // (např. `addReply` — „už odpovězeno?").
        const row: ReviewRow = {
          id: `rev_${reviewRows.length + 1}`,
          reviewerUserId: null,
          targetUserId: null,
          targetOrgId: null,
          evidenceResponseId: "",
          ratingCommunication: 0,
          ratingQuality: 0,
          ratingTimeliness: 0,
          ratingTransparency: 0,
          ratingProfessionalism: 0,
          text: null,
          status: "published",
          replyText: null,
          repliedAt: null,
          disputeReason: null,
          disputedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        reviewRows.push(row);
        return Promise.resolve(row);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ReviewRow>;
      }) => {
        const row = reviewRows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        row.updatedAt = new Date();
        return Promise.resolve(row);
      },
    },
  },
}));

import {
  checkEligibility,
  createReview,
  disputeReview,
  addReply,
  getReviewsForTarget,
  listEligibleReviews,
  updateReview,
} from "./service";

function seedRequest(
  overrides: Partial<{ id: string; ownerUserId: string; title: string }> = {},
) {
  const row = {
    id: "req_1",
    ownerUserId: "u-owner",
    title: "Rekonstrukce bytu",
    ...overrides,
  };
  requestRows.push(row);
  return row;
}

function seedResponse(overrides: Partial<ResponseRow> = {}): ResponseRow {
  const row: ResponseRow = {
    id: `resp_${responseRows.length + 1}`,
    requestId: "req_1",
    authorUserId: "u-pro",
    authorOrgId: null,
    status: "accepted",
    updatedAt: new Date(),
    ...overrides,
  };
  responseRows.push(row);
  return row;
}

const validRatings = {
  communication: 5,
  quality: 4,
  timeliness: 5,
  transparency: 4,
  professionalism: 5,
};

beforeEach(() => {
  responseRows = [];
  reviewRows = [];
  requestRows = [];
  reportContentMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkEligibility / createReview", () => {
  it("recenzi nelze založit bez accepted interakce", async () => {
    seedRequest();
    const response = seedResponse({ status: "sent" });

    const eligibility = await checkEligibility(response.id);
    expect(eligibility).toEqual({ ok: false, reason: "not_accepted" });

    const result = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    expect(result).toEqual({ ok: false, reason: "not_accepted" });
  });

  it("recenzi nelze založit nad neexistující interakcí", async () => {
    const result = await createReview({
      evidenceResponseId: "missing",
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    expect(result).toEqual({ ok: false, reason: "response_not_found" });
  });

  it("založí recenzi rovnou jako `published` nad accepted interakcí", async () => {
    seedRequest();
    const response = seedResponse();
    const result = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: "Skvělá spolupráce." },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view.status).toBe("published");
      expect(result.view.ratings).toEqual(validRatings);
    }
  });

  it("odmítne duplicitní recenzi na stejnou interakci", async () => {
    seedRequest();
    const response = seedResponse();
    const first = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    expect(first.ok).toBe(true);

    const second = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    expect(second).toEqual({ ok: false, reason: "already_reviewed" });
  });

  it("cizí uživatel (ne vlastník poptávky) nesmí založit recenzi", async () => {
    seedRequest();
    const response = seedResponse();
    const result = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-stranger",
      input: { ratings: validRatings, text: null },
    });
    expect(result).toEqual({ ok: false, reason: "not_accepted" });
  });
});

describe("listEligibleReviews", () => {
  it("nabídne accepted interakce vlastníka bez recenze", async () => {
    seedRequest();
    seedResponse();
    const items = await listEligibleReviews("u-owner");
    expect(items).toHaveLength(1);
    expect(items[0]!.requestTitle).toBe("Rekonstrukce bytu");
  });

  it("recenzovanou interakci dál nenabízí", async () => {
    seedRequest();
    const response = seedResponse();
    await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    const items = await listEligibleReviews("u-owner");
    expect(items).toHaveLength(0);
  });
});

describe("updateReview (24h okno)", () => {
  it("mimo 24h okno editaci odmítne", async () => {
    seedRequest();
    const response = seedResponse();
    const created = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    if (!created.ok) throw new Error("setup failed");
    const row = reviewRows.find((r) => r.id === created.view.id)!;
    row.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const result = await updateReview(created.view.id, "u-owner", {
      ratings: { ...validRatings, quality: 3 },
      text: "upraveno",
    });
    expect(result).toEqual({ ok: false, reason: "not_editable" });
  });

  it("uvnitř 24h okna editaci provede", async () => {
    seedRequest();
    const response = seedResponse();
    const created = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    if (!created.ok) throw new Error("setup failed");

    const result = await updateReview(created.view.id, "u-owner", {
      ratings: { ...validRatings, quality: 3 },
      text: "upraveno",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.view.ratings.quality).toBe(3);
  });
});

describe("addReply / disputeReview", () => {
  async function seedPublishedReview() {
    seedRequest();
    const response = seedResponse();
    const created = await createReview({
      evidenceResponseId: response.id,
      reviewerUserId: "u-owner",
      input: { ratings: validRatings, text: null },
    });
    if (!created.ok) throw new Error("setup failed");
    return created.view;
  }

  it("hodnocený smí odpovědět jednou", async () => {
    const review = await seedPublishedReview();
    const result = await addReply(review.id, "Děkujeme za zpětnou vazbu.");
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.view.replyText).toBe("Děkujeme za zpětnou vazbu.");

    const second = await addReply(review.id, "Ještě jednou díky.");
    expect(second).toEqual({ ok: false, reason: "already_replied" });
  });

  it("spor přepne recenzi na `disputed` a otevře moderační případ", async () => {
    const review = await seedPublishedReview();
    const result = await disputeReview(
      review.id,
      "u-pro",
      "Neodpovídá průběhu zakázky.",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.view.status).toBe("disputed");
      expect(result.view.disputeReason).toBe("Neodpovídá průběhu zakázky.");
    }
    expect(reportContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "review",
        targetId: review.id,
        reporterUserId: "u-pro",
        reason: "review_dispute",
      }),
    );
  });

  it("recenzi rozporovanou podruhé odmítne (jen z `published`)", async () => {
    const review = await seedPublishedReview();
    await disputeReview(review.id, "u-pro", "První spor je dost dlouhý.");
    const second = await disputeReview(
      review.id,
      "u-pro",
      "Druhý spor je taky dlouhý.",
    );
    expect(second).toEqual({ ok: false, reason: "invalid_transition" });
  });
});

describe("getReviewsForTarget — hidden se vyřadí z průměru i výpisu", () => {
  it("skrytá recenze se nepočítá a není ve výpisu; disputed zůstává", async () => {
    seedRequest({ id: "req_1", ownerUserId: "u-owner-1" });
    seedRequest({ id: "req_2", ownerUserId: "u-owner-2" });
    seedRequest({ id: "req_3", ownerUserId: "u-owner-3" });

    const r1 = seedResponse({
      id: "resp_1",
      requestId: "req_1",
      authorUserId: "u-pro",
    });
    const r2 = seedResponse({
      id: "resp_2",
      requestId: "req_2",
      authorUserId: "u-pro",
    });
    const r3 = seedResponse({
      id: "resp_3",
      requestId: "req_3",
      authorUserId: "u-pro",
    });

    const v1 = await createReview({
      evidenceResponseId: r1.id,
      reviewerUserId: "u-owner-1",
      input: { ratings: { ...validRatings, quality: 5 }, text: null },
    });
    const v2 = await createReview({
      evidenceResponseId: r2.id,
      reviewerUserId: "u-owner-2",
      input: { ratings: { ...validRatings, quality: 1 }, text: null },
    });
    const v3 = await createReview({
      evidenceResponseId: r3.id,
      reviewerUserId: "u-owner-3",
      input: { ratings: { ...validRatings, quality: 3 }, text: null },
    });
    if (!v1.ok || !v2.ok || !v3.ok) throw new Error("setup failed");

    // v2 je skrytá (simulace moderátorského zásahu), v3 je rozporovaná.
    const hiddenRow = reviewRows.find((r) => r.id === v2.view.id)!;
    hiddenRow.status = "hidden";
    const disputedRow = reviewRows.find((r) => r.id === v3.view.id)!;
    disputedRow.status = "disputed";

    const { aggregate, reviews } = await getReviewsForTarget({
      type: "professional",
      userId: "u-pro",
    });

    expect(reviews.map((r) => r.id).sort()).toEqual(
      [v1.view.id, v3.view.id].sort(),
    );
    expect(aggregate.count).toBe(2);
    expect(aggregate.criteriaAverages.quality).toBe(4); // (5 + 3) / 2, hidden (1) vyřazeno
  });
});
