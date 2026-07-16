import type { Meta, StoryObj } from "@storybook/nextjs";
import { RecommendationCard } from "./recommendation-card";
import type { MatchCandidateCard, MatchRecommendationView } from "../types";

/**
 * Kandidátní karta doporučení (T029 § Main flow bod 1–3). `Sponsored` ověřuje
 * acceptance kritérium „komponenta karty umí vykreslit označení „Sponzorováno""
 * — v MVP je `sponsored` vždy `false` v reálných datech, flag ale existuje
 * (zadani/16 §11 — žádný skrytý paid ranking).
 */
const meta = {
  title: "Matching/RecommendationCard",
  component: RecommendationCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof RecommendationCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const recommendation: MatchRecommendationView = {
  id: "rec_1",
  requestId: "req_1",
  candidateUserId: "user_1",
  score: 4.2,
  reasons: [
    {
      type: "similar_projects",
      detail: 'Realizoval 8 projekty typu „rekonstrukce bytu".',
    },
    { type: "region", detail: "Působí v regionu Praha." },
  ],
  status: "shown",
  sponsored: false,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
};

const candidate: MatchCandidateCard = {
  candidateUserId: "user_1",
  slug: "studio-novak",
  headline: "Studio Novák — rekonstrukce bytů a domů",
  professions: [
    { slug: "architekt", name: "Architekt", isPrimary: true },
    {
      slug: "interierovy-designer",
      name: "Interiérový designér",
      isPrimary: false,
    },
  ],
  location: "Praha",
  region: "Praha",
  bioSnippet:
    "Specializujeme se na citlivé rekonstrukce bytů a rodinných domů v historické zástavbě.",
  portfolioCoverUrl: null,
  publishedProjectCount: 8,
  badges: ["phone"],
};

export const Default: Story = {
  args: { recommendation, candidate, requestVisibility: "private" },
};

export const PublicRequest: Story = {
  args: { recommendation, candidate, requestVisibility: "public" },
};

export const Sponsored: Story = {
  args: {
    recommendation: { ...recommendation, sponsored: true },
    candidate,
    requestVisibility: "private",
  },
};

export const Shortlisted: Story = {
  args: {
    recommendation: { ...recommendation, status: "shortlisted" },
    candidate,
    requestVisibility: "private",
  },
};

export const Dismissed: Story = {
  args: {
    recommendation: { ...recommendation, status: "dismissed" },
    candidate,
    requestVisibility: "private",
  },
};

export const LimitedAvailability: Story = {
  args: {
    recommendation: {
      ...recommendation,
      reasons: [
        ...recommendation.reasons,
        { type: "limited_availability", detail: "Má omezenou kapacitu." },
      ],
    },
    candidate,
    requestVisibility: "private",
  },
};
