import { describe, expect, it } from "vitest";
import type {
  GuideAnswers,
  GuideResult,
  GuideStepDefinition,
  GuideSummary,
  GuideSummaryItem,
} from "@/features/guide";
import { generateBriefContent, suggestBriefTitle } from "./generator";
import type { GuideBriefSource } from "./generator";

/**
 * Testy generátoru briefu (T021). Kryjí acceptance kritéria: všechny povinné
 * sekce §18, poctivé „neuvedeno" u rozpočtu, důvod u profesí a soukromá adresa
 * mimo název i shrnutí.
 */

// --- Fixtures ---------------------------------------------------------------

const steps: GuideStepDefinition[] = [
  {
    key: "location",
    type: "location",
    prompt: "Kde se záměr nachází?",
    required: true,
  },
  {
    key: "ownership",
    type: "single_choice",
    prompt: "Jaký máte vztah k nemovitosti?",
    required: true,
    options: [
      { value: "own", label: "Již vlastním" },
      { value: "buying", label: "Kupuji" },
    ],
  },
  {
    key: "scope",
    type: "multi_choice",
    prompt: "Co chcete rekonstruovat?",
    required: true,
    options: [
      { value: "kitchen", label: "Kuchyň" },
      { value: "bath", label: "Koupelna" },
    ],
  },
  {
    key: "budget_known",
    type: "single_choice",
    prompt: "Znáte rozpočet?",
    required: true,
    options: [
      { value: "exact", label: "Znám přesnou částku" },
      { value: "unknown", label: "Neznám" },
    ],
  },
  {
    key: "budget_amount",
    type: "number",
    prompt: "Jaká je přibližná částka (Kč)?",
    required: true,
  },
  {
    key: "timing",
    type: "single_choice",
    prompt: "Kdy chcete začít?",
    required: true,
    options: [{ value: "within_3m", label: "Do 3 měsíců" }],
  },
  {
    key: "attachments",
    type: "file_ref",
    prompt: "Máte podklady?",
    required: false,
  },
  {
    key: "custom_furniture",
    type: "single_choice",
    prompt: "Chcete nábytek na míru?",
    required: false,
    options: [{ value: "yes", label: "Ano" }],
  },
];

/** Poskládá `GuideSummary.items` z odpovědí (viditelné kroky s uloženou odpovědí). */
function summaryItems(answers: GuideAnswers): GuideSummaryItem[] {
  return steps
    .filter((s) => answers[s.key])
    .map((s) => ({
      key: s.key,
      prompt: s.prompt,
      type: s.type,
      answer: answers[s.key],
    }));
}

function makeSummary(
  answers: GuideAnswers,
  overrides: Partial<GuideSummary> = {},
): GuideSummary {
  return {
    items: summaryItems(answers),
    missing: [],
    conflicts: [],
    staleAnswerKeys: [],
    progress: { answered: 0, total: 0, ratio: 0, complete: true },
    ...overrides,
  };
}

const outcomeResult: GuideResult = {
  outcomes: [
    {
      key: "primary",
      professions: [
        { slug: "architekt", name: "Architekt" },
        { slug: "statik", name: "Statik" },
      ],
      nextStep: "Oslovte architekta pro návrh dispozice.",
      prepare: [],
      safetyWarning: false,
    },
  ],
  safetyOutcomes: [],
  conflicts: [],
  missing: [],
  lowConfidence: false,
};

const fullAnswers: GuideAnswers = {
  location: {
    status: "answered",
    value: { city: "Praha", address: "Dlouhá 12", shareAddress: false },
  },
  ownership: { status: "answered", value: "own" },
  scope: { status: "answered", value: ["kitchen", "bath"] },
  budget_known: { status: "answered", value: "exact" },
  budget_amount: { status: "answered", value: 500000 },
  timing: { status: "answered", value: "within_3m" },
  attachments: { status: "answered", value: { mediaIds: ["m1", "m2"] } },
  custom_furniture: { status: "answered", value: "yes" },
};

function makeSource(
  answers: GuideAnswers,
  overrides: Partial<GuideBriefSource> = {},
): GuideBriefSource {
  return {
    def: {
      slug: "rekonstrukce-bytu",
      version: 1,
      name: "Rekonstrukce bytu",
      steps,
    },
    answers,
    summary: makeSummary(answers),
    result: outcomeResult,
    ...overrides,
  };
}

// --- Testy ------------------------------------------------------------------

describe("generateBriefContent — kompletní brief (§18)", () => {
  const content = generateBriefContent(makeSource(fullAnswers));

  it("naplní všechny povinné sekce §18", () => {
    expect(content.version).toBe(1);
    expect(content.summary).not.toBe("");
    expect(content.goal).not.toBe("");
    expect(content.projectType).toBe("Rekonstrukce bytu");
    expect(content.currentState).toBe("Již vlastním");
    expect(content.scope).toBe("Kuchyň, Koupelna");
    expect(content.location?.display).toBe("Praha");
    // Intl.NumberFormat vkládá pevnou mezeru (U+00A0) — porovnáváme normalizovaně.
    expect(content.budget.display).toMatch(/^500.000.Kč$/);
    expect(content.budget.known).toBe(true);
    expect(content.timing).toBe("Do 3 měsíců");
    expect(content.inputs.count).toBe(2);
    expect(content.recommendedProfessions.length).toBeGreaterThan(0);
    expect(content.nextStep).toBe("Oslovte architekta pro návrh dispozice.");
  });

  it("shrnutí je lidský popis a NEobsahuje přesnou adresu", () => {
    expect(content.summary).toContain("Rekonstrukce bytu");
    expect(content.summary).toContain("Praha");
    expect(content.summary).not.toContain("Dlouhá 12");
  });

  it("přesná adresa zůstává jen v soukromém poli lokality", () => {
    expect(content.location?.address).toBe("Dlouhá 12");
    expect(content.location?.shareAddress).toBe(false);
    expect(content.goal).not.toContain("Dlouhá 12");
  });

  it("preference obsahují jen nevyhrazené odpovědi", () => {
    const keys = content.preferences.map((p) => p.key);
    expect(keys).toContain("custom_furniture");
    expect(keys).not.toContain("location");
    expect(keys).not.toContain("budget_known");
    expect(keys).not.toContain("scope");
  });

  it("doporučené profese nesou důvod (§18)", () => {
    for (const prof of content.recommendedProfessions) {
      expect(prof.reason).toBe("Oslovte architekta pro návrh dispozice.");
    }
  });
});

describe("suggestBriefTitle", () => {
  it("navrhne název z typu + lokality, bez přesné adresy", () => {
    const title = suggestBriefTitle(makeSource(fullAnswers));
    expect(title).toBe("Rekonstrukce bytu – Praha");
    expect(title).not.toContain("Dlouhá 12");
  });

  it("bez lokality použije jen název scénáře", () => {
    const answers: GuideAnswers = {
      ownership: { status: "answered", value: "own" },
    };
    expect(suggestBriefTitle(makeSource(answers))).toBe("Rekonstrukce bytu");
  });
});

describe("rozpočet — poctivé „neuvedeno“ (acceptance)", () => {
  it("volba „Neznám“ → „Rozpočet neuveden“, žádné číslo", () => {
    const answers: GuideAnswers = {
      ...fullAnswers,
      budget_known: { status: "answered", value: "unknown" },
      budget_amount: { status: "skipped" },
    };
    const content = generateBriefContent(makeSource(answers));
    expect(content.budget.known).toBe(false);
    expect(content.budget.display).toBe("Rozpočet neuveden");
    expect(content.budget.display).not.toMatch(/\d/);
  });

  it("odpověď „Nevím“ u rozpočtu → „Rozpočet neuveden“", () => {
    const answers: GuideAnswers = {
      ...fullAnswers,
      budget_known: { status: "unknown" },
      budget_amount: { status: "unknown" },
    };
    const content = generateBriefContent(makeSource(answers));
    expect(content.budget.known).toBe(false);
    expect(content.budget.display).toBe("Rozpočet neuveden");
    expect(content.summary).not.toContain("Rozpočet");
  });
});

describe("samá „nevím“ — poctivě prázdné sekce + konzultace", () => {
  const answers: GuideAnswers = {
    location: { status: "unknown" },
    ownership: { status: "unknown" },
    budget_known: { status: "unknown" },
    timing: { status: "skipped" },
  };
  const lowResult: GuideResult = {
    outcomes: [
      {
        key: "fallback",
        professions: [{ slug: "architekt", name: "Architekt" }],
        nextStep: "Doporučujeme nezávaznou konzultaci.",
        prepare: [],
        safetyWarning: false,
      },
    ],
    safetyOutcomes: [],
    conflicts: [],
    missing: [
      { key: "location", prompt: "Kde se záměr nachází?" },
      { key: "ownership", prompt: "Jaký máte vztah k nemovitosti?" },
    ],
    lowConfidence: true,
  };
  const content = generateBriefContent(
    makeSource(answers, {
      result: lowResult,
      summary: makeSummary(answers, { missing: lowResult.missing }),
    }),
  );

  it("prázdné sekce jsou null/neuvedeno, ne dopočítané", () => {
    expect(content.location).toBeNull();
    expect(content.currentState).toBeNull();
    expect(content.timing).toBeNull();
    expect(content.budget.known).toBe(false);
  });

  it("chybějící podklady jsou vypsané a další krok = konzultace", () => {
    expect(content.missingInputs).toContain("Kde se záměr nachází?");
    expect(content.nextStep).toBe("Doporučujeme nezávaznou konzultaci.");
  });

  it("rizika obsahují upozornění na málo informací", () => {
    expect(content.risks.some((r) => r.includes("konzultace"))).toBe(true);
  });
});

describe("rizika — rozpory a bezpečnost", () => {
  it("promítne rozpory a bezpečnostní signál", () => {
    const result: GuideResult = {
      ...outcomeResult,
      conflicts: [{ key: "c1", message: "Termín se zdá nereálný." }],
      safetyOutcomes: [
        {
          key: "safety",
          professions: [{ slug: "statik", name: "Statik" }],
          nextStep: "Nechte posoudit statiku.",
          prepare: [],
          safetyWarning: true,
        },
      ],
    };
    const content = generateBriefContent(makeSource(fullAnswers, { result }));
    expect(content.risks).toContain("Termín se zdá nereálný.");
    expect(content.risks.some((r) => r.includes("bezpečnostní"))).toBe(true);
  });
});
