import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRecommendations,
  recomputeMatches,
  updateRecommendationStatus,
} from "./service";

/**
 * Integrační test datové vrstvy matching enginu (T028) nad in-memory mockem
 * `@/lib/db` (stejný přístup jako `features/messaging/service.test.ts`).
 * Pokrývá acceptance kritéria, která vyžadují DB vrstvu (čisté skórování je
 * v `scoring.test.ts`):
 *  - profese je TVRDÁ podmínka (kandidát bez shodné profese se nezobrazí),
 *  - konflikt zájmů (vlastník / člen jeho organizace) je vyloučen,
 *  - prázdný výsledek nese explicitní důvod, ne jen `[]`,
 *  - nový profesionál bez recenzí (žádné hodnocení v MVP, T037 slot) se
 *    v kandidátech objevuje — není ničím systémově pohřben,
 *  - deaktivovaný profil se z doporučení stáhne i bez přepočtu (lazy read).
 */

type ProfessionLink = {
  isPrimary: boolean;
  professionSlug: string;
  professionName: string;
};

type Profile = {
  userId: string;
  status: string;
  acceptingRequests: boolean;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  location: string | null;
  serviceAreas: string[];
  specializations: string[];
  projectTypes: string[];
  availability: string | null;
  yearsOfExperience: number | null;
  pricingModel: string | null;
  professions: ProfessionLink[];
};

type UserRow = { id: string; status: string };
type OrgMember = { orgId: string; userId: string };
type Verification = { userId: string; type: string; status: string };
type Portfolio = {
  ownerUserId: string | null;
  status: string;
  deletedAt: Date | null;
};
type ReqRow = {
  id: string;
  ownerUserId: string;
  region: string;
  targetProfessionSlugs: string[];
  briefSnapshot: unknown;
};
type Recommendation = {
  id: string;
  requestId: string;
  candidateUserId: string;
  score: number;
  reasons: unknown;
  status: string;
  sponsored: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let users: UserRow[] = [];
let profiles: Profile[] = [];
let orgMembers: OrgMember[] = [];
let verifications: Verification[] = [];
let portfolios: Portfolio[] = [];
let requests: ReqRow[] = [];
let recommendations: Recommendation[] = [];
let nextId = 1;

// `service.ts` importuje `listPublicPortfolioForUser` (hydratace kandidátních
// karet, T029), který transitivně sahá na `@/lib/session` (next-auth) — v
// testovém prostředí bez Next runtime by ESM import spadl na chybějícím
// `next/server`. Mock přerušuje řetězec stejně jako v `requests/service.test.ts`.
vi.mock("@/lib/session", () => ({
  getActor: () => Promise.resolve({ kind: "visitor" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    request: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(requests.find((r) => r.id === where.id) ?? null),
    },
    organizationMember: {
      findMany: ({
        where,
      }: {
        where: { userId?: string; orgId?: { in: string[] } };
      }) => {
        let rows = orgMembers;
        if (where.userId) rows = rows.filter((m) => m.userId === where.userId);
        if (where.orgId?.in)
          rows = rows.filter((m) => where.orgId!.in.includes(m.orgId));
        return Promise.resolve(rows);
      },
    },
    professionalProfile: {
      findMany: ({
        where,
      }: {
        where: {
          status: string;
          acceptingRequests: boolean;
          userId?: { notIn: string[] };
          user?: { status: string };
          professions?: { some: { profession: { slug: { in: string[] } } } };
        };
      }) => {
        let rows = profiles.filter(
          (p) =>
            p.status === where.status &&
            p.acceptingRequests === where.acceptingRequests,
        );
        if (where.userId?.notIn) {
          rows = rows.filter((p) => !where.userId!.notIn.includes(p.userId));
        }
        if (where.user?.status) {
          rows = rows.filter(
            (p) =>
              users.find((u) => u.id === p.userId)?.status ===
              where.user!.status,
          );
        }
        const slugs = where.professions?.some.profession.slug.in;
        if (slugs) {
          rows = rows.filter((p) =>
            p.professions.some((pp) => slugs.includes(pp.professionSlug)),
          );
        }
        return Promise.resolve(
          rows.map((p) => ({
            userId: p.userId,
            headline: p.headline,
            bio: p.bio,
            photoUrl: p.photoUrl,
            location: p.location,
            serviceAreas: p.serviceAreas,
            specializations: p.specializations,
            projectTypes: p.projectTypes,
            availability: p.availability,
            yearsOfExperience: p.yearsOfExperience,
            pricingModel: p.pricingModel,
            professions: p.professions
              .filter((pp) => !slugs || slugs.includes(pp.professionSlug))
              .map((pp) => ({
                isPrimary: pp.isPrimary,
                profession: {
                  slug: pp.professionSlug,
                  name: pp.professionName,
                },
              })),
          })),
        );
      },
    },
    verification: {
      findMany: ({ where }: { where: { userId: { in: string[] } } }) =>
        Promise.resolve(
          verifications.filter(
            (v) =>
              where.userId.in.includes(v.userId) &&
              v.status === "verified" &&
              ["phone", "email"].includes(v.type),
          ),
        ),
    },
    portfolioProject: {
      findMany: ({ where }: { where: { ownerUserId: { in: string[] } } }) =>
        Promise.resolve(
          portfolios.filter(
            (p) =>
              p.ownerUserId != null &&
              where.ownerUserId.in.includes(p.ownerUserId) &&
              p.status === "published" &&
              p.deletedAt === null,
          ),
        ),
    },
    matchRecommendation: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: {
          requestId_candidateUserId: {
            requestId: string;
            candidateUserId: string;
          };
        };
        create: {
          requestId: string;
          candidateUserId: string;
          score: number;
          reasons: unknown;
        };
        update: { score: number; reasons: unknown };
      }) => {
        const key = where.requestId_candidateUserId;
        const existing = recommendations.find(
          (r) =>
            r.requestId === key.requestId &&
            r.candidateUserId === key.candidateUserId,
        );
        if (existing) {
          existing.score = update.score;
          existing.reasons = update.reasons;
          existing.updatedAt = new Date();
          return Promise.resolve(existing);
        }
        const row: Recommendation = {
          id: `rec_${nextId++}`,
          requestId: create.requestId,
          candidateUserId: create.candidateUserId,
          score: create.score,
          reasons: create.reasons,
          status: "new",
          sponsored: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        recommendations.push(row);
        return Promise.resolve(row);
      },
      deleteMany: ({
        where,
      }: {
        where: { requestId: string; candidateUserId: { notIn: string[] } };
      }) => {
        const before = recommendations.length;
        recommendations = recommendations.filter(
          (r) =>
            !(
              r.requestId === where.requestId &&
              !where.candidateUserId.notIn.includes(r.candidateUserId)
            ),
        );
        return Promise.resolve({ count: before - recommendations.length });
      },
      findMany: ({ where }: { where: { requestId: string } }) => {
        const eligible = recommendations.filter((r) => {
          if (r.requestId !== where.requestId) return false;
          const user = users.find((u) => u.id === r.candidateUserId);
          const profile = profiles.find((p) => p.userId === r.candidateUserId);
          return (
            user?.status === "active" &&
            profile?.status === "published" &&
            profile?.acceptingRequests === true
          );
        });
        eligible.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.candidateUserId.localeCompare(b.candidateUserId);
        });
        return Promise.resolve(eligible);
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(recommendations.find((r) => r.id === where.id) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) => {
        const row = recommendations.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        row.status = data.status;
        row.updatedAt = new Date();
        return Promise.resolve(row);
      },
    },
  },
}));

afterEach(() => {
  users = [];
  profiles = [];
  orgMembers = [];
  verifications = [];
  portfolios = [];
  requests = [];
  recommendations = [];
});

function makeProfile(
  overrides: Partial<Profile> & { userId: string },
): Profile {
  return {
    status: "published",
    acceptingRequests: true,
    headline: null,
    bio: null,
    photoUrl: null,
    location: null,
    serviceAreas: [],
    specializations: [],
    projectTypes: [],
    availability: "open",
    yearsOfExperience: null,
    pricingModel: null,
    professions: [
      {
        isPrimary: true,
        professionSlug: "architekt",
        professionName: "Architekt",
      },
    ],
    ...overrides,
  };
}

const OWNER = "owner-1";

function makeRequest(overrides: Partial<ReqRow> = {}): ReqRow {
  return {
    id: "req-1",
    ownerUserId: OWNER,
    region: "Praha",
    targetProfessionSlugs: ["architekt"],
    briefSnapshot: null,
    ...overrides,
  };
}

describe("recomputeMatches — profese je tvrdá podmínka", () => {
  it("kandidát bez shodné profese se nikdy neobjeví, i s výborným profilem jinak", async () => {
    requests.push(makeRequest());
    users.push(
      { id: "cand-ok", status: "active" },
      { id: "cand-wrong-profession", status: "active" },
    );
    profiles.push(
      makeProfile({ userId: "cand-ok" }),
      makeProfile({
        userId: "cand-wrong-profession",
        professions: [
          {
            isPrimary: true,
            professionSlug: "elektrikar",
            professionName: "Elektrikář",
          },
        ],
      }),
    );

    const result = await recomputeMatches("req-1");
    expect(result).toEqual({ ok: true, candidateCount: 1 });

    const view = await getRecommendations("req-1");
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.recommendations.map((r) => r.candidateUserId)).toEqual([
        "cand-ok",
      ]);
    }
  });
});

describe("recomputeMatches — konflikt zájmů vyloučen", () => {
  it("vlastník poptávky sám sebe nikdy nedostane jako kandidáta", async () => {
    requests.push(makeRequest());
    users.push({ id: OWNER, status: "active" });
    profiles.push(makeProfile({ userId: OWNER }));

    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok && view.recommendations).toHaveLength(0);
  });

  it("člen stejné organizace jako vlastník je vyloučen", async () => {
    requests.push(makeRequest());
    orgMembers.push(
      { orgId: "org-1", userId: OWNER },
      { orgId: "org-1", userId: "cand-colleague" },
    );
    users.push(
      { id: "cand-colleague", status: "active" },
      { id: "cand-outsider", status: "active" },
    );
    profiles.push(
      makeProfile({ userId: "cand-colleague" }),
      makeProfile({ userId: "cand-outsider" }),
    );

    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(
      view.ok && view.recommendations.map((r) => r.candidateUserId),
    ).toEqual(["cand-outsider"]);
  });
});

describe("prázdný výsledek nese explicitní důvod", () => {
  it("žádný vhodný kandidát → recommendations: [] + emptyReason, ne jen []", async () => {
    requests.push(makeRequest());
    // Žádní profesionálové v DB vůbec.
    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(view.recommendations).toEqual([]);
      expect(view.emptyReason).toBe("no_eligible_professionals");
    }
  });

  it("neprázdný výsledek nemá emptyReason", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-ok", status: "active" });
    profiles.push(makeProfile({ userId: "cand-ok" }));
    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok && view.emptyReason).toBeNull();
  });
});

describe("nový profesionál bez recenzí se v kandidátech objevuje", () => {
  it("kandidát bez jakéhokoliv hodnocení (T037 slot neexistuje) není vyloučen ani penalizován hodnocením", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-new", status: "active" });
    profiles.push(
      makeProfile({
        userId: "cand-new",
        headline: null,
        bio: null,
        yearsOfExperience: null,
      }),
    );
    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok && view.recommendations).toHaveLength(1);
  });
});

describe("validace kandidáta (§ Validation)", () => {
  it("nepublikovaný profil se nenabídne", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-draft", status: "active" });
    profiles.push(makeProfile({ userId: "cand-draft", status: "draft" }));
    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok && view.recommendations).toHaveLength(0);
  });

  it("profil bez acceptingRequests se nenabídne", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-not-accepting", status: "active" });
    profiles.push(
      makeProfile({ userId: "cand-not-accepting", acceptingRequests: false }),
    );
    await recomputeMatches("req-1");
    const view = await getRecommendations("req-1");
    expect(view.ok && view.recommendations).toHaveLength(0);
  });
});

describe("deaktivovaný profil → doporučení staženo (§ Edge cases)", () => {
  it("kandidát, který přestane vyhovovat PO výpočtu, zmizí z čtení i bez nového přepočtu", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-ok", status: "active" });
    profiles.push(makeProfile({ userId: "cand-ok" }));
    await recomputeMatches("req-1");

    const before = await getRecommendations("req-1");
    expect(before.ok && before.recommendations).toHaveLength(1);

    // Profil se odpublikuje (bez volání recomputeMatches).
    profiles[0]!.status = "draft";

    const after = await getRecommendations("req-1");
    expect(after.ok && after.recommendations).toHaveLength(0);
    expect(after.ok && after.emptyReason).toBe("no_eligible_professionals");
  });

  it("přepočet fyzicky smaže doporučení kandidáta, který přestal vyhovovat", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-ok", status: "active" });
    profiles.push(makeProfile({ userId: "cand-ok" }));
    await recomputeMatches("req-1");
    expect(recommendations).toHaveLength(1);

    profiles[0]!.acceptingRequests = false;
    await recomputeMatches("req-1");
    expect(recommendations).toHaveLength(0);
  });
});

describe("updateRecommendationStatus", () => {
  it("new -> shown -> shortlisted projde", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-ok", status: "active" });
    profiles.push(makeProfile({ userId: "cand-ok" }));
    await recomputeMatches("req-1");
    const id = recommendations[0]!.id;

    const shown = await updateRecommendationStatus(id, "shown");
    expect(shown.ok && shown.view.status).toBe("shown");
    const shortlisted = await updateRecommendationStatus(id, "shortlisted");
    expect(shortlisted.ok && shortlisted.view.status).toBe("shortlisted");
  });

  it("neplatný přechod (new -> dismissed přímo) je odmítnut", async () => {
    requests.push(makeRequest());
    users.push({ id: "cand-ok", status: "active" });
    profiles.push(makeProfile({ userId: "cand-ok" }));
    await recomputeMatches("req-1");
    const id = recommendations[0]!.id;

    const result = await updateRecommendationStatus(id, "dismissed");
    expect(result).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("neexistující doporučení vrátí not_found", async () => {
    const result = await updateRecommendationStatus("missing", "shown");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
