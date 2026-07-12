/**
 * Obsah guide scénářů (T019). Čistá data — engine (T017) i seed (`prisma/seed`)
 * z nich staví běh. Zdroj: `zadani/legacy-master-spec.md` §7 a §9–17.
 *
 * Model: 14 samostatných scénářů (§7 = 14 vstupních karet, „každý scénář spouští
 * jinou větev"). Každý sdílí OBECNÉ otázky (§9 — lokalita, vlastnictví, rozpočet,
 * čas, podklady) přes tovární funkce níže a přidává vlastní specifické kroky
 * (§10–17) a VÝSTUPY (`outcomes`) — mapování koncových větví na doporučené profese
 * (slugy z taxonomie T005), další krok a podklady k přípravě.
 *
 * INVARIANTY (`validation.ts` je hlídá při seedu):
 * - žádná slepá ulička — každá průchozí větev sedne aspoň na jeden výstup; proto
 *   má každý scénář ZÁCHRANNÝ výstup bez `when` (poslední, uplatní se, nesedne-li
 *   specifičtější) — vždy odborné posouzení/konzultace, nikdy vymyšlený závěr
 *   (zadani/16 §4);
 * - „nevím"/„přeskočit" nikdy neblokují a klíčové větve je routují na posouzení
 *   (např. B: nevím, zda nosná → statik; nikdy „lze bourat");
 * - bezpečnostní triggery (§15) nesou flag `safetyWarning` (render řeší T020).
 *
 * Mimo T019: engine (T017), UI (T018), render výstupů/varování (T020), admin
 * editace (T035).
 */

import type {
  GuideConflictRule,
  GuideOutcome,
  GuideScenarioDefinition,
  GuideStepDefinition,
} from "./types";

// --- Obecné otázky (§9) — sdílené tovární funkce ----------------------------
//
// Vrací VŽDY nový objekt (data se nesdílejí referencí mezi scénáři). Klíče jsou
// stabilní napříč scénáři, takže podmínky/výstupy na ně odkazují jednotně.

/** §9.1 Lokalita. Přesná adresa je volitelná a soukromá (řeší hodnota lokality). */
function locationStep(
  condition?: GuideStepDefinition["condition"],
): GuideStepDefinition {
  return {
    key: "location",
    type: "location",
    prompt: "Kde se záměr nachází?",
    help: "Stačí město nebo region. Přesnou adresu můžete sdílet až později a jen se souhlasem.",
    required: true,
    ...(condition ? { condition } : {}),
  };
}

/** §9.2 Vlastnický vztah. */
function ownershipStep(
  condition?: GuideStepDefinition["condition"],
): GuideStepDefinition {
  return {
    key: "ownership",
    type: "single_choice",
    prompt: "Jaký máte vztah k nemovitosti?",
    required: true,
    options: [
      { value: "own", label: "Již vlastním" },
      { value: "buying", label: "Kupuji" },
      { value: "renting", label: "Pronajímám" },
      { value: "agent", label: "Jednám za vlastníka" },
      { value: "considering", label: "Zatím pouze zvažuji" },
    ],
    ...(condition ? { condition } : {}),
  };
}

/**
 * §9.3 Rozpočet — rozlišuje znalost částky (přesná / rozpětí / odhad / neznám) a
 * rozsah (projekt / realizace / celkem / vč. vybavení). Vrací celou skupinu kroků
 * s navazujícími podmínkami; `budget_amount`/`budget_range` se odkryjí dle volby.
 */
function budgetSteps(): GuideStepDefinition[] {
  return [
    {
      key: "budget_known",
      type: "single_choice",
      prompt: "Znáte rozpočet?",
      required: true,
      options: [
        { value: "exact", label: "Znám přesnou částku" },
        { value: "range", label: "Znám cenové rozpětí" },
        { value: "estimate", label: "Potřebuji odhad" },
        { value: "unknown", label: "Neznám" },
      ],
    },
    {
      key: "budget_scope",
      type: "single_choice",
      prompt: "Čeho se rozpočet týká?",
      help: "Zpřesnění, zda jde o samotný projekt, realizaci, nebo vše dohromady. Uvádějte prosím vč. / bez DPH podle toho, jak částku znáte.",
      required: false,
      condition: {
        op: "in",
        step: "budget_known",
        values: ["exact", "range"],
      },
      options: [
        { value: "project", label: "Pouze projekt" },
        { value: "realization", label: "Pouze realizace" },
        { value: "total", label: "Celkový rozpočet" },
        { value: "with_equipment", label: "Včetně vybavení" },
      ],
    },
    {
      key: "budget_amount",
      type: "number",
      prompt: "Jaká je přibližná částka (Kč)?",
      required: true,
      config: { min: 0 },
      condition: { op: "equals", step: "budget_known", value: "exact" },
    },
    {
      key: "budget_range",
      type: "range",
      prompt: "Jaké je cenové rozpětí (Kč)?",
      required: true,
      config: { min: 0 },
      condition: { op: "equals", step: "budget_known", value: "range" },
    },
  ];
}

/** §9.4 Čas. */
function timingStep(): GuideStepDefinition {
  return {
    key: "timing",
    type: "single_choice",
    prompt: "Kdy chcete začít?",
    required: true,
    options: [
      { value: "immediately", label: "Okamžitě" },
      { value: "within_1m", label: "Do 1 měsíce" },
      { value: "within_3m", label: "Do 3 měsíců" },
      { value: "within_6m", label: "Do 6 měsíců" },
      { value: "within_year", label: "Do 1 roku" },
      { value: "later", label: "Později" },
      { value: "unknown", label: "Nevím" },
    ],
  };
}

/** §9.5 Podklady. */
function attachmentsStep(
  condition?: GuideStepDefinition["condition"],
): GuideStepDefinition {
  return {
    key: "attachments",
    type: "file_ref",
    prompt: "Máte podklady (fotky, půdorysy, dokumentaci, inzerát)?",
    help: "Fotografie, půdorysy, PDF, projektová dokumentace, zaměření, katastrální podklady, cenová nabídka, odkaz na inzerát nebo mapu.",
    required: false,
    ...(condition ? { condition } : {}),
  };
}

/** Rozpor: „zatím jen zvažuji" + „okamžitě" — nereálný termín. */
const consideringButImmediate: GuideConflictRule = {
  key: "considering_but_immediate",
  message:
    "Uvedli jste, že nemovitost zatím jen zvažujete, ale chcete začít okamžitě — zvažte, zda je termín reálný.",
  when: {
    op: "all",
    conditions: [
      { op: "equals", step: "ownership", value: "considering" },
      { op: "equals", step: "timing", value: "immediately" },
    ],
  },
};

/** Záchranný výstup — uplatní se, nesedne-li žádný specifičtější (žádná slepá ulička). */
function fallbackOutcome(
  professions: string[],
  nextStep: string,
  extra: Partial<GuideOutcome> = {},
): GuideOutcome {
  return { key: "fallback", professions, nextStep, ...extra };
}

// --- Scénář A: Nový dům (§10) ------------------------------------------------

const novyDum: GuideScenarioDefinition = {
  slug: "novy-dum",
  version: 1,
  name: "Chci postavit nový dům",
  steps: [
    {
      key: "stage",
      type: "single_choice",
      prompt: "V jaké fázi je váš záměr?",
      help: "Podle fáze se liší, koho budete potřebovat jako prvního.",
      required: true,
      options: [
        { value: "idea", label: "Mám jen představu (fáze nápadu)" },
        { value: "land", label: "Mám pozemek, ne projekt (fáze pozemku)" },
        { value: "study", label: "Mám koncept / studii (fáze studie)" },
        { value: "project", label: "Mám dokumentaci (fáze projektu)" },
        { value: "realization", label: "Hledám firmu (fáze realizace)" },
      ],
    },
    {
      key: "has_land",
      type: "single_choice",
      prompt: "Máte vybraný pozemek?",
      required: true,
      condition: { op: "equals", step: "stage", value: "idea" },
      options: [
        { value: "yes", label: "Ano, mám ho" },
        { value: "selected", label: "Mám vybraný, ještě nekoupený" },
        { value: "no", label: "Zatím ne" },
      ],
    },
    locationStep(),
    {
      key: "size",
      type: "single_choice",
      prompt: "Jakou máte představu o velikosti domu?",
      required: false,
      options: [
        { value: "small", label: "Menší (do 100 m²)" },
        { value: "medium", label: "Střední (100–180 m²)" },
        { value: "large", label: "Větší (nad 180 m²)" },
      ],
    },
    {
      key: "energy",
      type: "single_choice",
      prompt: "Máte energetické preference?",
      help: "Standardní, nízkoenergetický nebo pasivní dům. Ovlivní to volbu specialistů i dotační možnosti.",
      required: false,
      options: [
        { value: "standard", label: "Standard" },
        { value: "low_energy", label: "Nízkoenergetický" },
        { value: "passive", label: "Pasivní dům" },
      ],
    },
    {
      key: "service",
      type: "single_choice",
      prompt: "Chcete kompletní službu, nebo dílčí pomoc?",
      required: false,
      options: [
        { value: "full", label: "Kompletní službu (návrh i realizace)" },
        { value: "partial", label: "Dílčí pomoc" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  // (Bez rozporu „considering + immediately" — nový dům nemá vlastnický vztah.)
  outcomes: [
    {
      key: "realization",
      when: { op: "equals", step: "stage", value: "realization" },
      professions: [
        "generalni-dodavatel",
        "firma-na-rodinne-domy",
        "technicky-dozor-investora",
        "rozpoctar",
      ],
      nextStep:
        "Máte dokumentaci — oslovte realizační firmy a zajistěte si technický dozor investora, který ohlídá kvalitu a rozpočet.",
      prepare: ["Projektová dokumentace", "Stavební povolení", "Výkaz výměr"],
    },
    {
      key: "project",
      when: { op: "equals", step: "stage", value: "project" },
      professions: [
        "rozpoctar",
        "generalni-dodavatel",
        "technicky-dozor-investora",
      ],
      nextStep:
        "S hotovou dokumentací dává smysl nechat zpracovat rozpočet a připravit výběr zhotovitele.",
      prepare: ["Projektová dokumentace", "Cenová představa"],
    },
    {
      key: "passive",
      when: { op: "equals", step: "energy", value: "passive" },
      professions: [
        "architekt",
        "energeticky-specialista",
        "projektant-rodinnych-domu",
        "dotacni-poradenstvi",
      ],
      nextStep:
        "Pro pasivní dům přizvěte energetického specialistu už do fáze návrhu a prověřte dotace (Nová zelená úsporám).",
      prepare: [
        "Představa o velikosti a orientaci domu",
        "Informace o pozemku",
      ],
    },
    {
      key: "land",
      when: { op: "in", step: "stage", values: ["land", "study"] },
      professions: [
        "architekt",
        "projektant-rodinnych-domu",
        "geodet",
        "geolog",
      ],
      nextStep:
        "Máte pozemek — začněte architektonickou studií. Geodet a geolog prověří pozemek pro založení stavby.",
      prepare: [
        "Katastrální podklady k pozemku",
        "Informace o sítích a přístupu",
      ],
    },
  ],
};

// --- Scénář B: Rekonstrukce domu (§11) --------------------------------------

const rekonstrukceDomu: GuideScenarioDefinition = {
  slug: "rekonstrukce-domu",
  version: 1,
  name: "Chci rekonstruovat dům",
  steps: [
    ownershipStep(),
    locationStep(),
    {
      key: "age",
      type: "single_choice",
      prompt: "Jak starý je dům?",
      required: false,
      options: [
        { value: "under_30", label: "Do 30 let" },
        { value: "30_60", label: "30–60 let" },
        { value: "over_60", label: "Přes 60 let" },
        { value: "historic", label: "Historický / památkově chráněný" },
      ],
    },
    {
      key: "scope",
      type: "multi_choice",
      prompt: "Co má rekonstrukce zahrnovat?",
      help: "Vyberte vše, co plánujete řešit.",
      required: true,
      config: { minSelected: 1 },
      options: [
        { value: "layout", label: "Změny dispozice" },
        { value: "roof", label: "Střecha" },
        { value: "facade", label: "Fasáda / zateplení" },
        { value: "windows", label: "Okna" },
        { value: "electricity", label: "Elektroinstalace" },
        { value: "water", label: "Voda a odpady" },
        { value: "heating", label: "Vytápění" },
        { value: "damp", label: "Vlhkost" },
      ],
    },
    {
      key: "demolition",
      type: "single_choice",
      prompt: "Plánujete bourat nebo posouvat stěny?",
      required: true,
      options: [
        { value: "yes", label: "Ano, chci bourat stěny" },
        { value: "no", label: "Ne" },
        { value: "maybe", label: "Zvažuji to" },
      ],
    },
    {
      // §11 povinná doplňující otázka při bourání. „nevím" NIKDY netvrdí, že lze
      // bourat — výstup routuje na statika.
      key: "load_bearing",
      type: "single_choice",
      prompt: "Víte, zda je některá z těchto stěn nosná?",
      help: "Nosná stěna přenáší zatížení konstrukce. Bez posouzení statika se do ní nesmí zasahovat.",
      required: true,
      condition: { op: "in", step: "demolition", values: ["yes", "maybe"] },
      options: [
        { value: "not_bearing", label: "Vím, že nejsou nosné" },
        { value: "bearing", label: "Ano, jsou (nebo mohou být) nosné" },
        { value: "dont_know", label: "Nevím" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  conflicts: [consideringButImmediate],
  outcomes: [
    {
      // AC: bourat + „nevím, zda nosná" → statik, nikdy „lze bourat".
      key: "structural_assessment",
      when: {
        op: "all",
        conditions: [
          { op: "in", step: "demolition", values: ["yes", "maybe"] },
          {
            op: "not",
            condition: {
              op: "equals",
              step: "load_bearing",
              value: "not_bearing",
            },
          },
        ],
      },
      professions: ["statik", "projektant-rekonstrukci", "architekt"],
      nextStep:
        "Než cokoli zbouráte, nechte stěny posoudit statikem. Do nosné konstrukce se nesmí zasahovat bez jeho návrhu — nelze předem tvrdit, že bourat lze.",
      prepare: ["Půdorysy stávajícího stavu", "Fotografie stěn"],
    },
    {
      key: "damp",
      when: { op: "includes", step: "scope", value: "damp" },
      professions: ["specialista-vlhkosti", "diagnostik-staveb"],
      nextStep:
        "Vlhkost je potřeba nejdřív diagnostikovat (příčinu), teprve pak sanovat.",
      prepare: [
        "Fotografie projevů vlhkosti",
        "Informace o stáří a stavu domu",
      ],
    },
    {
      key: "energy",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "scope", value: "facade" },
          { op: "includes", step: "scope", value: "heating" },
        ],
      },
      professions: [
        "energeticky-specialista",
        "projektant-rekonstrukci",
        "vytapeni",
        "dotacni-poradenstvi",
      ],
      nextStep:
        "U zateplení a vytápění se vyplatí energetické posouzení a prověření dotací (Nová zelená úsporám).",
      prepare: ["Informace o stávajícím vytápění", "Půdorysy"],
    },
  ],
};

// --- Scénář C: Rekonstrukce bytu (§12) --------------------------------------

const rekonstrukceBytu: GuideScenarioDefinition = {
  slug: "rekonstrukce-bytu",
  version: 1,
  name: "Chci rekonstruovat byt",
  steps: [
    ownershipStep(),
    locationStep(),
    {
      key: "scope",
      type: "multi_choice",
      prompt: "Co má rekonstrukce bytu zahrnovat?",
      required: true,
      config: { minSelected: 1 },
      options: [
        { value: "layout", label: "Zásah do dispozice" },
        { value: "bathroom", label: "Koupelna" },
        { value: "kitchen", label: "Kuchyň" },
        { value: "electricity", label: "Elektroinstalace" },
        { value: "floors", label: "Podlahy" },
        { value: "acoustics", label: "Akustika" },
      ],
    },
    {
      key: "load_bearing",
      type: "single_choice",
      prompt: "Zasahuje změna dispozice do nosných stěn nebo příček?",
      help: "V bytovém domě je zásah do nosných konstrukcí vázán na posouzení statika a souhlas SVJ.",
      required: true,
      condition: { op: "includes", step: "scope", value: "layout" },
      options: [
        { value: "not_bearing", label: "Jen nenosné příčky" },
        { value: "bearing", label: "Ano, i nosné" },
        { value: "dont_know", label: "Nevím" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "structural_assessment",
      when: {
        op: "all",
        conditions: [
          { op: "includes", step: "scope", value: "layout" },
          {
            op: "not",
            condition: {
              op: "equals",
              step: "load_bearing",
              value: "not_bearing",
            },
          },
        ],
      },
      professions: ["statik", "interierovy-architekt", "stavebni-pravo"],
      nextStep:
        "Zásah do nosných konstrukcí v bytě nechte posoudit statikem a ověřte souhlas SVJ — bez toho nelze bourat.",
      prepare: ["Půdorys bytu", "Kontakt na SVJ / správce domu"],
    },
    {
      key: "kitchen_bath",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "scope", value: "kitchen" },
          { op: "includes", step: "scope", value: "bathroom" },
        ],
      },
      professions: [
        "interierovy-architekt",
        "instalater",
        "obkladac",
        "kuchynske-studio",
      ],
      nextStep:
        "Pro koupelnu a kuchyň se vyplatí návrh interiérového architekta a koordinace instalatéra a obkladače.",
      prepare: ["Půdorys bytu", "Představa vybavení"],
    },
  ],
};

// --- Scénář: Návrh interiéru (§7.4) -----------------------------------------

const navrhInterieru: GuideScenarioDefinition = {
  slug: "navrh-interieru",
  version: 1,
  name: "Chci navrhnout interiér",
  steps: [
    {
      key: "space",
      type: "single_choice",
      prompt: "Jaký prostor chcete navrhnout?",
      required: true,
      options: [
        { value: "apartment", label: "Byt" },
        { value: "house", label: "Rodinný dům" },
        { value: "single_room", label: "Jedna místnost" },
        { value: "commercial", label: "Komerční prostor" },
      ],
    },
    locationStep(),
    {
      key: "depth",
      type: "single_choice",
      prompt: "Co od návrhu čekáte?",
      required: false,
      options: [
        { value: "concept", label: "Koncept a náladu" },
        { value: "full", label: "Kompletní návrh vč. výkresů" },
        { value: "custom_furniture", label: "Hlavně nábytek na míru" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "custom_furniture",
      when: { op: "equals", step: "depth", value: "custom_furniture" },
      professions: ["interierovy-architekt", "zakazkovy-nabytek", "truhlar"],
      nextStep:
        "Pro nábytek na míru spojte interiérového architekta s truhlářem nebo zakázkovou výrobou.",
      prepare: ["Zaměření prostoru", "Fotografie a inspirace"],
    },
    {
      key: "commercial",
      when: { op: "equals", step: "space", value: "commercial" },
      professions: ["interierovy-architekt", "svetelny-designer"],
      nextStep:
        "Komerční interiér řešte s interiérovým architektem se zkušeností s daným provozem.",
      prepare: ["Půdorys prostoru", "Popis provozu a značky"],
    },
  ],
};

// --- Scénář D: Koupě nemovitosti (§13) --------------------------------------

const koupeNemovitosti: GuideScenarioDefinition = {
  slug: "koupe-nemovitosti",
  version: 1,
  name: "Chci koupit nemovitost a prověřit ji",
  steps: [
    {
      key: "property_type",
      type: "single_choice",
      prompt: "O jakou nemovitost jde?",
      required: true,
      options: [
        { value: "house", label: "Rodinný dům" },
        { value: "apartment", label: "Byt" },
        { value: "commercial", label: "Komerční / jiná" },
      ],
    },
    locationStep(),
    {
      key: "purpose",
      type: "single_choice",
      prompt: "K čemu nemovitost plánujete?",
      required: false,
      options: [
        { value: "living", label: "Bydlení beze změn" },
        { value: "reconstruction", label: "Rekonstrukci" },
        { value: "investment", label: "Investici / pronájem" },
      ],
    },
    {
      key: "concern",
      type: "multi_choice",
      prompt: "Co vás na nemovitosti nejvíc zajímá nebo znepokojuje?",
      required: false,
      options: [
        { value: "structure", label: "Stav konstrukcí" },
        { value: "damp", label: "Vlhkost / plísně" },
        { value: "energy", label: "Energetická náročnost" },
        { value: "layout", label: "Možnosti přestavby" },
        { value: "price", label: "Přiměřenost ceny" },
      ],
    },
    {
      key: "decision_time",
      type: "single_choice",
      prompt: "Kdy se rozhodujete?",
      required: false,
      options: [
        { value: "urgent", label: "Velmi brzy (dny)" },
        { value: "weeks", label: "V řádu týdnů" },
        { value: "flexible", label: "Mám čas" },
      ],
    },
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "structure_concern",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "concern", value: "structure" },
          { op: "includes", step: "concern", value: "damp" },
        ],
      },
      professions: ["inspektor-nemovitosti", "statik", "diagnostik-staveb"],
      nextStep:
        "Před koupí doporučujeme kombinaci technické inspekce nemovitosti a statického posouzení.",
      prepare: ["Odkaz na inzerát", "Fotografie", "Termín prohlídky"],
    },
    {
      key: "layout_potential",
      when: { op: "includes", step: "concern", value: "layout" },
      professions: ["architekt", "inspektor-nemovitosti"],
      nextStep:
        "Pro posouzení potenciálu přestavby přizvěte architekta ještě před koupí, spolu s technickou inspekcí.",
      prepare: ["Půdorysy z inzerátu", "Odkaz na inzerát"],
    },
    {
      key: "price",
      when: { op: "includes", step: "concern", value: "price" },
      professions: ["odhadce", "inspektor-nemovitosti"],
      nextStep:
        "K přiměřenosti ceny pomůže odhadce; technická inspekce odhalí skryté náklady.",
      prepare: ["Odkaz na inzerát", "Podklady k ceně"],
    },
  ],
};

// --- Scénář E: Koupě pozemku (§14) ------------------------------------------

const koupePozemku: GuideScenarioDefinition = {
  slug: "koupe-pozemku",
  version: 1,
  name: "Chci koupit pozemek a zjistit, co na něm lze udělat",
  steps: [
    locationStep(),
    {
      key: "known_regulation",
      type: "single_choice",
      prompt: "Znáte územní plán / regulaci pro pozemek?",
      help: "Územní plán určuje, co a jak se na pozemku smí stavět. Guide nenahrazuje závazné vyjádření úřadu.",
      required: false,
      options: [
        { value: "yes", label: "Ano, znám" },
        { value: "partly", label: "Částečně" },
        { value: "no", label: "Neznám" },
      ],
    },
    {
      key: "utilities",
      type: "single_choice",
      prompt: "Jsou u pozemku inženýrské sítě?",
      required: false,
      options: [
        { value: "all", label: "Ano, všechny" },
        { value: "some", label: "Některé" },
        { value: "none", label: "Žádné" },
        { value: "unknown", label: "Nevím" },
      ],
    },
    {
      key: "slope",
      type: "single_choice",
      prompt: "Jaký je terén?",
      required: false,
      options: [
        { value: "flat", label: "Rovinatý" },
        { value: "mild", label: "Mírný svah" },
        { value: "steep", label: "Výrazný svah" },
      ],
    },
    {
      key: "planned_build",
      type: "single_choice",
      prompt: "Co na pozemku plánujete?",
      required: false,
      options: [
        { value: "house", label: "Rodinný dům" },
        { value: "recreation", label: "Rekreační objekt" },
        { value: "unsure", label: "Zatím nevím" },
      ],
    },
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "planning",
      when: {
        op: "any",
        conditions: [
          { op: "equals", step: "known_regulation", value: "no" },
          { op: "unknown", step: "known_regulation" },
        ],
      },
      professions: ["urbanista", "architekt", "specialista-povolovani"],
      nextStep:
        "Než pozemek koupíte, nechte prověřit územní plán a zastavitelnost. Jde o orientační posouzení — závazné je až vyjádření stavebního úřadu.",
      prepare: ["Číslo parcely / katastrální podklady", "Odkaz na mapu"],
    },
    {
      key: "steep",
      when: { op: "equals", step: "slope", value: "steep" },
      professions: ["geolog", "hydrogeolog", "geodet", "architekt"],
      nextStep:
        "U svažitého pozemku prověřte podloží (geolog) a zaměření (geodet) — zásadně ovlivní náklady na založení.",
      prepare: ["Katastrální podklady", "Informace o přístupu"],
    },
    {
      key: "utilities",
      when: { op: "in", step: "utilities", values: ["none", "unknown"] },
      professions: ["geodet", "specialista-povolovani", "urbanista"],
      nextStep:
        "Bez sítí prověřte možnosti a náklady na jejich přivedení — bývá to velká položka rozpočtu.",
      prepare: ["Informace o okolní zástavbě", "Odkaz na mapu"],
    },
  ],
};

// --- Scénář G: Změna dispozice (§16) ----------------------------------------

const zmenaDispozice: GuideScenarioDefinition = {
  slug: "zmena-dispozice",
  version: 1,
  name: "Chci změnit dispozici",
  steps: [
    {
      key: "object_type",
      type: "single_choice",
      prompt: "O jaký objekt jde?",
      required: true,
      options: [
        { value: "apartment", label: "Byt" },
        { value: "house", label: "Rodinný dům" },
        { value: "commercial", label: "Komerční prostor" },
      ],
    },
    ownershipStep(),
    locationStep(),
    {
      key: "wall_changes",
      type: "single_choice",
      prompt: "Vyžaduje změna zásah do stěn?",
      required: true,
      options: [
        { value: "none", label: "Ne, jen vybavení a povrchy" },
        { value: "partitions", label: "Ano, nenosné příčky" },
        { value: "structural", label: "Ano, i nosné stěny" },
        { value: "dont_know", label: "Nevím" },
      ],
    },
    {
      key: "moves",
      type: "multi_choice",
      prompt: "Budete přesouvat kuchyň, koupelnu nebo rozvody?",
      required: false,
      options: [
        { value: "kitchen", label: "Kuchyň" },
        { value: "bathroom", label: "Koupelnu" },
        { value: "water", label: "Rozvody vody" },
        { value: "none", label: "Nic z toho" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "structural",
      when: {
        op: "in",
        step: "wall_changes",
        values: ["structural", "dont_know"],
      },
      professions: [
        "statik",
        "projektant-rekonstrukci",
        "interierovy-architekt",
      ],
      nextStep:
        "Zásah do nosných stěn (nebo pokud nevíte, zda jsou nosné) vyžaduje posouzení statika a projekt — nelze předem tvrdit, že změnu lze provést.",
      prepare: ["Stávající půdorys", "Představa nového uspořádání"],
    },
    {
      key: "partitions",
      when: { op: "equals", step: "wall_changes", value: "partitions" },
      professions: ["interierovy-architekt", "projektant-rekonstrukci"],
      nextStep:
        "U nenosných příček stačí dispoziční studie a projekt; ověřte jen vedení instalací.",
      prepare: ["Stávající půdorys"],
    },
    {
      key: "cosmetic",
      when: { op: "equals", step: "wall_changes", value: "none" },
      professions: ["interierovy-architekt"],
      nextStep:
        "Bez zásahu do stěn zvládne novou dispozici interiérový architekt formou rychlé studie.",
      prepare: ["Stávající půdorys", "Inspirace"],
    },
  ],
};

// --- Scénář: Přístavba / nástavba (§7.8) ------------------------------------

const pristavbaNastavba: GuideScenarioDefinition = {
  slug: "pristavba-nastavba",
  version: 1,
  name: "Chci přístavbu nebo nástavbu",
  steps: [
    {
      key: "type",
      type: "single_choice",
      prompt: "Jde o přístavbu, nebo nástavbu?",
      help: "Přístavba rozšiřuje půdorys, nástavba přidává podlaží (např. obytné podkroví).",
      required: true,
      options: [
        { value: "extension", label: "Přístavba (do stran)" },
        { value: "addition", label: "Nástavba (nahoru)" },
        { value: "both", label: "Obojí" },
      ],
    },
    ownershipStep(),
    locationStep(),
    {
      key: "structural_known",
      type: "single_choice",
      prompt: "Víte, zda stávající konstrukce zvládne zatížení?",
      help: "Nástavba i přístavba přenášejí zatížení do stávajících konstrukcí a základů.",
      required: true,
      condition: { op: "in", step: "type", values: ["addition", "both"] },
      options: [
        { value: "assessed", label: "Ano, je to posouzené" },
        { value: "no", label: "Ne" },
        { value: "dont_know", label: "Nevím" },
      ],
    },
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "structural",
      when: { op: "in", step: "type", values: ["addition", "both"] },
      professions: ["statik", "architekt", "specialista-povolovani"],
      nextStep:
        "Nástavba zásadně závisí na únosnosti stávající konstrukce a základů — začněte posouzením statika a ověřením povolovacího režimu.",
      prepare: ["Půdorysy a řezy stávajícího objektu", "Fotografie"],
    },
  ],
};

// --- Scénář F: Technický problém (§15) --------------------------------------

const technickyProblem: GuideScenarioDefinition = {
  slug: "technicky-problem",
  version: 1,
  name: "Mám technický problém se stavbou",
  steps: [
    {
      // §15 bezpečnost má přednost — akutní příznaky ptáme jako první.
      key: "acute_signs",
      type: "multi_choice",
      prompt: "Objevil se některý z těchto akutních příznaků?",
      help: "Pokud ano, může jít o havarijní situaci. Guide nenahrazuje havarijní službu.",
      required: true,
      options: [
        { value: "crack_fast", label: "Rychle rostoucí velká trhlina" },
        { value: "deformation", label: "Viditelná deformace konstrukce" },
        { value: "burning_smell", label: "Zápach po spálenině" },
        { value: "gas_leak", label: "Únik plynu" },
        { value: "flooded_electrics", label: "Zaplavená elektroinstalace" },
        { value: "none", label: "Nic z uvedeného" },
      ],
    },
    {
      key: "problem",
      type: "single_choice",
      prompt: "Jaký problém řešíte především?",
      required: true,
      options: [
        { value: "damp", label: "Vlhkost / plíseň" },
        { value: "cracks", label: "Praskliny" },
        { value: "leaks", label: "Zatékání" },
        { value: "unevenness", label: "Nerovnosti / sedání" },
        { value: "noise", label: "Hluk" },
        { value: "overheating", label: "Přehřívání" },
        { value: "smell", label: "Zápach" },
        { value: "electricity", label: "Problém s elektro" },
        { value: "heating", label: "Problém s vytápěním" },
        { value: "unknown", label: "Nevím / neznámý problém" },
      ],
    },
    locationStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      // §15 bezpečnostní trigger → safetyWarning flag (render T020).
      key: "safety",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "acute_signs", value: "crack_fast" },
          { op: "includes", step: "acute_signs", value: "deformation" },
          { op: "includes", step: "acute_signs", value: "burning_smell" },
          { op: "includes", step: "acute_signs", value: "gas_leak" },
          { op: "includes", step: "acute_signs", value: "flooded_electrics" },
        ],
      },
      professions: ["statik", "diagnostik-staveb"],
      nextStep:
        "Popsané příznaky mohou být havarijní. Přerušte užívání dotčené části a kontaktujte příslušnou havarijní/pohotovostní službu (hasiči 150/112, pohotovost plynu 1239, revizní technik). Guide nenahrazuje havarijní službu.",
      safetyWarning: true,
    },
    {
      key: "cracks",
      when: {
        op: "any",
        conditions: [
          { op: "equals", step: "problem", value: "cracks" },
          { op: "equals", step: "problem", value: "unevenness" },
        ],
      },
      professions: ["statik", "diagnostik-staveb", "geolog"],
      nextStep:
        "Praskliny a sedání nechte posoudit statikem a diagnostikem staveb, kteří určí příčinu a závažnost.",
      prepare: ["Fotografie prasklin s měřítkem", "Kdy se objevily"],
    },
    {
      key: "damp",
      when: { op: "equals", step: "problem", value: "damp" },
      professions: ["specialista-vlhkosti", "diagnostik-staveb"],
      nextStep:
        "U vlhkosti a plísní je klíčové najít příčinu — začněte specialistou na vlhkost.",
      prepare: ["Fotografie", "Informace o stáří a stavu objektu"],
    },
    {
      key: "leaks",
      when: { op: "equals", step: "problem", value: "leaks" },
      professions: ["izolater", "pokryvac", "klempir"],
      nextStep:
        "Zatékání nejčastěji řeší izolatér nebo pokrývač podle místa průniku vody.",
      prepare: ["Fotografie", "Odkud voda zatéká"],
    },
    {
      key: "electricity",
      when: { op: "equals", step: "problem", value: "electricity" },
      professions: ["elektrikar"],
      nextStep:
        "Problém s elektroinstalací přenechte kvalifikovanému elektrikáři s revizí.",
      prepare: ["Popis projevů", "Stáří elektroinstalace"],
    },
    {
      key: "heating",
      when: {
        op: "any",
        conditions: [
          { op: "equals", step: "problem", value: "heating" },
          { op: "equals", step: "problem", value: "overheating" },
        ],
      },
      professions: ["topenar", "vytapeni"],
      nextStep:
        "Potíže s vytápěním a přehříváním posoudí topenář nebo specialista TZB.",
      prepare: ["Popis projevů", "Typ zdroje tepla"],
    },
    {
      key: "noise",
      when: { op: "equals", step: "problem", value: "noise" },
      professions: ["akustik", "diagnostik-staveb"],
      nextStep: "Nadměrný hluk změří akustik a navrhne opatření.",
      prepare: ["Popis zdroje hluku", "Kdy je hluk nejhorší"],
    },
  ],
};

// --- Scénář: Zahrada / venkovní prostor (§7.10) -----------------------------

const zahradaExterier: GuideScenarioDefinition = {
  slug: "zahrada-exterier",
  version: 1,
  name: "Chci zahradu nebo venkovní prostor",
  steps: [
    {
      key: "goal",
      type: "multi_choice",
      prompt: "Co chcete na zahradě řešit?",
      required: true,
      config: { minSelected: 1 },
      options: [
        { value: "design", label: "Celkový návrh zahrady" },
        { value: "terrace", label: "Terasu" },
        { value: "pergola", label: "Pergolu" },
        { value: "pool", label: "Bazén / jezírko" },
        { value: "fence", label: "Oplocení" },
        { value: "irrigation", label: "Závlahu" },
        { value: "planting", label: "Osázení / zeleň" },
      ],
    },
    locationStep(),
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "design",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "goal", value: "design" },
          { op: "includes", step: "goal", value: "planting" },
        ],
      },
      professions: ["zahradni-architekt", "zahradni-realizace"],
      nextStep:
        "Pro celkový návrh a osázení začněte zahradním architektem, realizaci pak předá zahradnické firmě.",
      prepare: ["Zaměření nebo katastrální podklady", "Fotografie pozemku"],
    },
    {
      key: "pool",
      when: { op: "includes", step: "goal", value: "pool" },
      professions: ["bazeny", "zahradni-realizace"],
      nextStep:
        "Bazén či jezírko řešte se specializovanou firmou; ověřte podloží a odvodnění.",
      prepare: ["Umístění na pozemku", "Představa velikosti"],
    },
    {
      key: "structures",
      when: {
        op: "any",
        conditions: [
          { op: "includes", step: "goal", value: "terrace" },
          { op: "includes", step: "goal", value: "pergola" },
          { op: "includes", step: "goal", value: "fence" },
        ],
      },
      professions: ["terasy", "pergoly", "oploceni"],
      nextStep:
        "Terasu, pergolu i plot postaví specializované realizační firmy podle vybraného materiálu.",
      prepare: ["Rozměry", "Fotografie místa"],
    },
  ],
};

// --- Scénář: Hledám stavební firmu (§7.11) ----------------------------------

const hledamFirmu: GuideScenarioDefinition = {
  slug: "hledam-firmu",
  version: 1,
  name: "Hledám stavební firmu",
  steps: [
    {
      key: "work_type",
      type: "single_choice",
      prompt: "Jaký typ prací potřebujete?",
      required: true,
      options: [
        { value: "new_house", label: "Stavba nového domu" },
        { value: "reconstruction", label: "Rekonstrukce" },
        { value: "timber", label: "Dřevostavba" },
        { value: "groundworks", label: "Zemní práce" },
        { value: "trade", label: "Konkrétní řemeslo" },
      ],
    },
    {
      key: "has_docs",
      type: "single_choice",
      prompt: "Máte projektovou dokumentaci nebo výkaz výměr?",
      help: "S dokumentací dostanete od firem porovnatelné nabídky.",
      required: true,
      options: [
        { value: "full", label: "Ano, kompletní" },
        { value: "partial", label: "Částečně" },
        { value: "none", label: "Ne" },
      ],
    },
    locationStep(),
    ...budgetSteps(),
    timingStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "no_docs",
      when: { op: "equals", step: "has_docs", value: "none" },
      professions: ["projektovy-manazer", "rozpoctar", "architekt"],
      nextStep:
        "Bez dokumentace nelze poptat porovnatelné nabídky. Nejdřív si nechte připravit alespoň rozsah prací a výkaz výměr.",
      prepare: ["Popis prací", "Fotografie / půdorysy"],
    },
    {
      key: "new_house",
      when: { op: "equals", step: "work_type", value: "new_house" },
      professions: [
        "generalni-dodavatel",
        "firma-na-rodinne-domy",
        "technicky-dozor-investora",
      ],
      nextStep:
        "Pro stavbu domu oslovte generálního dodavatele a zajistěte si technický dozor investora.",
      prepare: ["Projektová dokumentace", "Výkaz výměr"],
    },
    {
      key: "timber",
      when: { op: "equals", step: "work_type", value: "timber" },
      professions: ["drevostavby", "specialista-drevostavby"],
      nextStep:
        "Pro dřevostavbu vybírejte firmu se specializací na tento typ konstrukce.",
      prepare: ["Projektová dokumentace", "Cenová představa"],
    },
    {
      key: "reconstruction",
      when: { op: "equals", step: "work_type", value: "reconstruction" },
      professions: ["rekonstrukcni-firma", "technicky-dozor-investora"],
      nextStep:
        "Pro rekonstrukci oslovte specializovanou firmu a zvažte technický dozor.",
      prepare: ["Rozsah prací", "Fotografie / půdorysy"],
    },
    {
      key: "groundworks",
      when: { op: "equals", step: "work_type", value: "groundworks" },
      professions: ["zemni-prace"],
      nextStep: "Zemní a výkopové práce zajistí specializovaná firma.",
      prepare: ["Rozsah prací", "Přístup na pozemek"],
    },
  ],
};

// --- Scénář: Hledám konkrétní profesi (§7.12) -------------------------------

const hledamProfesi: GuideScenarioDefinition = {
  slug: "hledam-profesi",
  version: 1,
  name: "Hledám konkrétní profesi",
  steps: [
    {
      key: "category",
      type: "single_choice",
      prompt: "Jakou profesi hledáte?",
      help: "Pokud si nejste jistí, vyberte oblast a doporučíme konkrétní profesi.",
      required: true,
      options: [
        { value: "design", label: "Návrh / architektura" },
        { value: "structures", label: "Statika / konstrukce" },
        {
          value: "services",
          label: "Technická zařízení (elektro, voda, topení)",
        },
        { value: "energy", label: "Energetika / dotace" },
        { value: "survey", label: "Průzkumy a diagnostika" },
        { value: "trade", label: "Řemeslo" },
        { value: "cost", label: "Rozpočet / příprava" },
      ],
    },
    locationStep(),
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "design",
      when: { op: "equals", step: "category", value: "design" },
      professions: [
        "architekt",
        "interierovy-architekt",
        "projektant-pozemnich-staveb",
      ],
      nextStep: "Podle rozsahu vyberte architekta nebo projektanta.",
    },
    {
      key: "structures",
      when: { op: "equals", step: "category", value: "structures" },
      professions: ["statik", "konstrukter"],
      nextStep: "Pro statiku a konstrukce oslovte statika.",
    },
    {
      key: "services",
      when: { op: "equals", step: "category", value: "services" },
      professions: ["elektrikar", "instalater", "topenar", "vytapeni"],
      nextStep:
        "Vyberte řemeslníka podle konkrétní profese (elektro, voda, topení).",
    },
    {
      key: "energy",
      when: { op: "equals", step: "category", value: "energy" },
      professions: ["energeticky-specialista", "dotacni-poradenstvi"],
      nextStep: "Pro energetiku a dotace oslovte energetického specialistu.",
    },
    {
      key: "survey",
      when: { op: "equals", step: "category", value: "survey" },
      professions: ["geodet", "diagnostik-staveb", "geolog"],
      nextStep:
        "Podle typu průzkumu vyberte geodeta, geologa nebo diagnostika staveb.",
    },
    {
      key: "trade",
      when: { op: "equals", step: "category", value: "trade" },
      professions: ["zednik", "elektrikar", "instalater", "truhlar"],
      nextStep: "Vyberte konkrétní řemeslo podle prací, které potřebujete.",
    },
    {
      key: "cost",
      when: { op: "equals", step: "category", value: "cost" },
      professions: ["rozpoctar", "pripravar"],
      nextStep: "Pro rozpočet a přípravu stavby oslovte rozpočtáře.",
    },
  ],
};

// --- Scénář: Konzultace (§7.13) ---------------------------------------------

const konzultace: GuideScenarioDefinition = {
  slug: "konzultace",
  version: 1,
  name: "Chci pouze konzultaci",
  steps: [
    {
      key: "topic",
      type: "single_choice",
      prompt: "Čeho se má konzultace týkat?",
      required: true,
      options: [
        { value: "design", label: "Návrh / architektura" },
        { value: "reconstruction", label: "Rekonstrukce" },
        { value: "purchase", label: "Koupě nemovitosti" },
        { value: "technical", label: "Technický problém" },
        { value: "budget", label: "Rozpočet / náklady" },
        { value: "other", label: "Něco jiného" },
      ],
    },
    {
      key: "description",
      type: "text",
      prompt: "Popište krátce, co byste chtěli probrat.",
      required: false,
      config: { maxLength: 1000 },
    },
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "design",
      when: { op: "equals", step: "topic", value: "design" },
      professions: ["architekt", "interierovy-architekt"],
      nextStep: "Objednejte si úvodní konzultaci s architektem.",
    },
    {
      key: "reconstruction",
      when: { op: "equals", step: "topic", value: "reconstruction" },
      professions: ["architekt", "projektant-rekonstrukci", "statik"],
      nextStep:
        "Pro rekonstrukci pomůže konzultace s architektem, případně statikem.",
    },
    {
      key: "purchase",
      when: { op: "equals", step: "topic", value: "purchase" },
      professions: ["inspektor-nemovitosti", "technicky-poradce-pri-koupi"],
      nextStep:
        "Před koupí konzultujte s technickým poradcem nebo inspektorem nemovitostí.",
    },
    {
      key: "technical",
      when: { op: "equals", step: "topic", value: "technical" },
      professions: ["diagnostik-staveb", "statik"],
      nextStep: "Technický problém proberte s diagnostikem staveb.",
    },
    {
      key: "budget",
      when: { op: "equals", step: "topic", value: "budget" },
      professions: ["rozpoctar"],
      nextStep: "K nákladům a rozpočtu se hodí konzultace s rozpočtářem.",
    },
  ],
};

// --- Scénář H: Nevím, co potřebuji (§17) ------------------------------------
//
// Klíčová větev: volný popis → cílené doplňující otázky → návrh kategorií s
// vysvětlením (`note`), NIKDY vymyšlený závěr (zadani/16 §4).

const nevimCoPotrebuji: GuideScenarioDefinition = {
  slug: "nevim-co-potrebuji",
  version: 1,
  name: "Nevím, co přesně potřebuji",
  steps: [
    {
      key: "description",
      type: "text",
      prompt: "Popište prosím vlastními slovy, co řešíte.",
      help: "Nemusí to být přesné. Podle popisu vám navrhneme, kudy dál.",
      required: false,
      config: { maxLength: 2000 },
    },
    {
      key: "area",
      type: "single_choice",
      prompt: "Čeho se to nejvíc týká?",
      required: true,
      options: [
        { value: "look", label: "Vzhledu / uspořádání prostoru" },
        { value: "technical", label: "Technického problému nebo poruchy" },
        { value: "buy_sell", label: "Koupě nebo prodeje nemovitosti" },
        { value: "build", label: "Nové stavby nebo velké přestavby" },
        { value: "unsure", label: "Opravdu nevím" },
      ],
    },
    {
      key: "urgency",
      type: "single_choice",
      prompt: "Jak je to naléhavé?",
      required: false,
      options: [
        { value: "urgent", label: "Naléhavé" },
        { value: "soon", label: "Brzy" },
        { value: "exploring", label: "Zatím se jen rozhlížím" },
      ],
    },
    attachmentsStep(),
  ],
  outcomes: [
    {
      key: "look",
      when: { op: "equals", step: "area", value: "look" },
      professions: ["interierovy-architekt", "architekt"],
      nextStep:
        "Podle popisu vám nejspíš pomůže interiérový architekt — navrhne uspořádání a vzhled prostoru.",
      note: "Vybrali jste vzhled a uspořádání prostoru, což je doména interiérového architekta. Pokud jde i o zásah do stěn, přidá se statik.",
    },
    {
      key: "technical",
      when: { op: "equals", step: "area", value: "technical" },
      professions: ["diagnostik-staveb", "statik"],
      nextStep:
        "Popis ukazuje na technický problém — začněte diagnostikou stavby, která určí příčinu.",
      note: "U poruch je klíčové nejdřív zjistit příčinu; diagnostik staveb (a podle potřeby statik) je správný první krok, ne rovnou řemeslník.",
    },
    {
      key: "buy_sell",
      when: { op: "equals", step: "area", value: "buy_sell" },
      professions: ["inspektor-nemovitosti", "technicky-poradce-pri-koupi"],
      nextStep:
        "Jde o koupi/prodej — pomůže technický poradce nebo inspekce nemovitosti před rozhodnutím.",
      note: "Před koupí se vyplatí nezávislé technické posouzení, které odhalí skryté náklady.",
    },
    {
      key: "build",
      when: { op: "equals", step: "area", value: "build" },
      professions: ["architekt", "statik"],
      nextStep:
        "Podle popisu pravděpodobně nepotřebujete rovnou stavební firmu. Nejprve doporučujeme architektonickou konzultaci a posouzení statika.",
      note: "U nové stavby nebo velké přestavby se začíná návrhem a posouzením proveditelnosti, ne výběrem zhotovitele.",
    },
  ],
};

// --- Registr ----------------------------------------------------------------

/**
 * Přidá scénáři záchranný výstup (bez `when`) na konec seznamu. Zaručuje, že
 * ŽÁDNÁ větev nekončí bez doporučení — nesedne-li specifičtější výstup, uplatní
 * se odborná konzultace/posouzení (nikdy vymyšlený závěr).
 */
function withFallback(
  def: GuideScenarioDefinition,
  fallback: GuideOutcome,
): GuideScenarioDefinition {
  return { ...def, outcomes: [...(def.outcomes ?? []), fallback] };
}

/** Všechny zabudované scénáře (zdroj pro seed a validaci). Pořadí = §7. */
export const BUILTIN_SCENARIOS: GuideScenarioDefinition[] = [
  withFallback(
    novyDum,
    fallbackOutcome(
      ["architekt", "projektant-rodinnych-domu"],
      "Začněte architektonickou konzultací — pomůže ujasnit záměr, rozsah i další kroky.",
      { prepare: ["Představa o domě a pozemku"] },
    ),
  ),
  withFallback(
    rekonstrukceDomu,
    fallbackOutcome(
      ["architekt", "projektant-rekonstrukci", "diagnostik-staveb"],
      "Začněte konzultací s architektem nebo projektantem rekonstrukcí, který navrhne rozsah a další kroky.",
      { prepare: ["Fotografie", "Půdorysy, pokud je máte"] },
    ),
  ),
  withFallback(
    rekonstrukceBytu,
    fallbackOutcome(
      ["interierovy-architekt", "projektant-rekonstrukci"],
      "Začněte konzultací s interiérovým architektem, který navrhne rozsah a pořadí prací.",
      { prepare: ["Půdorys bytu", "Fotografie"] },
    ),
  ),
  withFallback(
    navrhInterieru,
    fallbackOutcome(
      ["interierovy-architekt", "interierovy-designer"],
      "Objednejte si úvodní konzultaci s interiérovým architektem.",
      { prepare: ["Zaměření prostoru", "Inspirace"] },
    ),
  ),
  withFallback(
    koupeNemovitosti,
    fallbackOutcome(
      ["inspektor-nemovitosti", "technicky-poradce-pri-koupi"],
      "Před koupí doporučujeme technickou inspekci nemovitosti a případně architektonickou konzultaci.",
      { prepare: ["Odkaz na inzerát", "Fotografie"] },
    ),
  ),
  withFallback(
    koupePozemku,
    fallbackOutcome(
      ["urbanista", "architekt", "geodet"],
      "Před koupí pozemku prověřte územní plán a zastavitelnost s urbanistou či architektem. Guide nedává právně závazné potvrzení zastavitelnosti.",
      { prepare: ["Katastrální podklady", "Odkaz na mapu"] },
    ),
  ),
  withFallback(
    zmenaDispozice,
    fallbackOutcome(
      ["interierovy-architekt", "projektant-rekonstrukci"],
      "Začněte dispoziční studií u interiérového architekta nebo projektanta.",
      { prepare: ["Stávající půdorys"] },
    ),
  ),
  withFallback(
    pristavbaNastavba,
    fallbackOutcome(
      ["architekt", "statik", "specialista-povolovani"],
      "Začněte konzultací s architektem a statikem, kteří posoudí proveditelnost a povolovací režim.",
      { prepare: ["Půdorysy a řezy", "Fotografie objektu"] },
    ),
  ),
  withFallback(
    technickyProblem,
    fallbackOutcome(
      ["diagnostik-staveb"],
      "Nechte problém posoudit diagnostikem staveb, který určí příčinu a doporučí řešení.",
      { prepare: ["Fotografie", "Popis, kdy a jak se problém projevuje"] },
    ),
  ),
  withFallback(
    zahradaExterier,
    fallbackOutcome(
      ["zahradni-architekt", "zahradni-realizace"],
      "Začněte konzultací se zahradním architektem, který navrhne řešení a rozsah.",
      { prepare: ["Fotografie pozemku", "Zaměření nebo katastrální podklady"] },
    ),
  ),
  withFallback(
    hledamFirmu,
    fallbackOutcome(
      ["projektovy-manazer", "rozpoctar"],
      "Abyste dostali porovnatelné nabídky, nechte si nejdřív připravit rozsah prací a výkaz výměr.",
      { prepare: ["Popis prací", "Fotografie / půdorysy"] },
    ),
  ),
  withFallback(
    hledamProfesi,
    fallbackOutcome(
      ["architekt", "diagnostik-staveb"],
      "Nejste-li si jistí profesí, začněte krátkou konzultací s architektem nebo diagnostikem staveb.",
    ),
  ),
  withFallback(
    konzultace,
    fallbackOutcome(
      ["architekt"],
      "Objednejte si úvodní konzultaci s architektem, který vás nasměruje dál.",
    ),
  ),
  withFallback(
    nevimCoPotrebuji,
    fallbackOutcome(
      ["architekt", "statik"],
      "Podle popisu zatím nepotřebujete rovnou stavební firmu. Doporučujeme začít architektonickou konzultací a podle potřeby posouzením statika, které ujasní další kroky.",
      {
        note: "Nemáme dost informací pro konkrétní závěr. Úvodní konzultace bezpečně ujasní, co skutečně potřebujete — nic si nevymýšlíme.",
      },
    ),
  ),
];

/** Slugy všech scénářů (vstupní karty §7), v pořadí zobrazení. */
export const ALL_SCENARIO_SLUGS = BUILTIN_SCENARIOS.map((s) => s.slug);
