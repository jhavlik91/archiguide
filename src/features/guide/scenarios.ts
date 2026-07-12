/**
 * Zabudované guide scénáře (T017). Čistá data — engine i seed z nich staví běh.
 *
 * MVP obsahuje jeden funkční scénář „Co chcete vyřešit?" (legacy-master-spec §7),
 * který demonstruje jádro enginu: podmíněné větvení, „nevím"/„přeskočit" jako
 * validní odpovědi a pravidla rozporů. Reálné, obsahově bohaté scénáře dodá T019;
 * admin editace T035. Tento registr je jediný zdroj pro seed (`prisma/seed`).
 */

import type { GuideScenarioDefinition } from "./types";

/** Hlavní vstupní scénář guide. Stabilní slug napříč verzemi. */
export const MAIN_SCENARIO_SLUG = "co-chcete-vyresit";

const mainScenario: GuideScenarioDefinition = {
  slug: MAIN_SCENARIO_SLUG,
  version: 1,
  name: "Co chcete vyřešit?",
  steps: [
    {
      key: "intent",
      type: "single_choice",
      prompt: "Co chcete vyřešit?",
      required: true,
      options: [
        { value: "new_build", label: "Chci postavit nový dům" },
        { value: "reconstruction", label: "Chci rekonstruovat dům nebo byt" },
        {
          value: "buy_check",
          label: "Chci koupit nemovitost a prověřit ji",
        },
        { value: "consultation", label: "Chci pouze konzultaci" },
        { value: "unsure", label: "Nevím, co přesně potřebuji" },
      ],
    },
    {
      key: "location",
      type: "location",
      prompt: "Kde se záměr nachází?",
      help: "Stačí město nebo region. Přesnou adresu můžete sdílet až později a jen se souhlasem.",
      required: true,
      // Lokalita nedává smysl jen u čisté konzultace.
      condition: {
        op: "not",
        condition: { op: "equals", step: "intent", value: "consultation" },
      },
    },
    {
      key: "ownership",
      type: "single_choice",
      prompt: "Jaký máte vztah k nemovitosti?",
      required: true,
      condition: {
        op: "in",
        step: "intent",
        values: ["reconstruction", "buy_check"],
      },
      options: [
        { value: "own", label: "Již vlastním" },
        { value: "buying", label: "Kupuji" },
        { value: "considering", label: "Zatím pouze zvažuji" },
      ],
    },
    {
      key: "new_build_stage",
      type: "single_choice",
      prompt: "V jaké fázi je příprava stavby?",
      required: true,
      condition: { op: "equals", step: "intent", value: "new_build" },
      options: [
        { value: "land_only", label: "Mám jen pozemek" },
        { value: "have_project", label: "Mám projekt" },
        { value: "have_permit", label: "Mám stavební povolení" },
      ],
    },
    {
      key: "problem",
      type: "text",
      prompt: "Popište prosím krátce, co řešíte.",
      required: false,
      config: { maxLength: 1000 },
      condition: { op: "equals", step: "intent", value: "unsure" },
    },
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
    {
      key: "timing",
      type: "single_choice",
      prompt: "Kdy chcete začít?",
      required: true,
      options: [
        { value: "immediately", label: "Okamžitě" },
        { value: "within_3m", label: "Do 3 měsíců" },
        { value: "within_year", label: "Do roka" },
        { value: "later", label: "Později" },
      ],
    },
    {
      key: "attachments",
      type: "file_ref",
      prompt: "Máte podklady (fotky, půdorysy, dokumentaci)?",
      required: false,
      condition: {
        op: "in",
        step: "intent",
        values: ["reconstruction", "buy_check", "new_build"],
      },
    },
  ],
  conflicts: [
    {
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
    },
  ],
};

/** Všechny zabudované scénáře (zdroj pro seed a validaci). */
export const BUILTIN_SCENARIOS: GuideScenarioDefinition[] = [mainScenario];
