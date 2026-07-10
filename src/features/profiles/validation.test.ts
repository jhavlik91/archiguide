import { describe, expect, it } from "vitest";
import {
  availabilitySchema,
  basicsSchema,
  expertiseSchema,
  onboardingAvailabilitySchema,
  onboardingLocationSchema,
  onboardingSpecializationsSchema,
  onboardingStepSchema,
  pricingSchema,
  professionsSchema,
} from "./validation";
import { HEADLINE_MAX_LENGTH } from "./types";

describe("basicsSchema", () => {
  it("prázdný titulek → undefined (nevím je validní)", () => {
    const out = basicsSchema.parse({ headline: "   " });
    expect(out.headline).toBeUndefined();
    expect(out.serviceAreas).toEqual([]);
    expect(out.languages).toEqual([]);
  });

  it("odmítne titulek nad limit", () => {
    const res = basicsSchema.safeParse({
      headline: "x".repeat(HEADLINE_MAX_LENGTH + 1),
    });
    expect(res.success).toBe(false);
  });

  it("ořízne a deduplikuje seznamy", () => {
    const out = basicsSchema.parse({
      serviceAreas: [" Praha ", "Praha", "Brno"],
      languages: ["cs", "cs"],
    });
    expect(out.serviceAreas).toEqual(["Praha", "Brno"]);
    expect(out.languages).toEqual(["cs"]);
  });

  it("odmítne neplatnou URL fotky", () => {
    expect(basicsSchema.safeParse({ photoUrl: "neni-url" }).success).toBe(false);
    expect(basicsSchema.parse({ photoUrl: "" }).photoUrl).toBeUndefined();
  });
});

describe("expertiseSchema", () => {
  it("akceptuje prázdné roky praxe", () => {
    expect(expertiseSchema.parse({}).yearsOfExperience).toBeUndefined();
  });

  it("odmítne záporné roky praxe", () => {
    expect(
      expertiseSchema.safeParse({ yearsOfExperience: -1 }).success,
    ).toBe(false);
  });

  it("coercuje řetězec na roky praxe", () => {
    expect(expertiseSchema.parse({ yearsOfExperience: "5" }).yearsOfExperience).toBe(
      5,
    );
  });
});

describe("availabilitySchema", () => {
  it("odmítne neznámou dostupnost", () => {
    expect(availabilitySchema.safeParse({ availability: "nope" }).success).toBe(
      false,
    );
  });

  it("deduplikuje formy spolupráce", () => {
    const out = availabilitySchema.parse({
      collaborationForms: ["remote", "remote", "hybrid"],
    });
    expect(out.collaborationForms).toEqual(["remote", "hybrid"]);
  });
});

describe("pricingSchema", () => {
  it("akceptuje prázdný cenový model", () => {
    expect(pricingSchema.parse({}).pricingModel).toBeUndefined();
  });

  it("odmítne neznámý cenový model", () => {
    expect(pricingSchema.safeParse({ pricingModel: "barter" }).success).toBe(
      false,
    );
  });
});

describe("professionsSchema", () => {
  it("přijme více profesí s příznakem hlavní", () => {
    const out = professionsSchema.parse({
      professions: [
        { professionId: "a", isPrimary: true },
        { professionId: "b" },
      ],
    });
    expect(out.professions).toHaveLength(2);
    expect(out.professions[1].isPrimary).toBe(false);
  });

  it("odmítne prázdné professionId", () => {
    expect(
      professionsSchema.safeParse({ professions: [{ professionId: "" }] })
        .success,
    ).toBe(false);
  });
});

describe("onboarding úzká schémata", () => {
  it("lokalita: prázdná je validní (nevím neblokuje)", () => {
    expect(onboardingLocationSchema.parse({ location: "  " }).location).toBeUndefined();
    expect(onboardingLocationSchema.parse({ location: "Praha" }).location).toBe(
      "Praha",
    );
  });

  it("specializace: deduplikuje a ořízne", () => {
    expect(
      onboardingSpecializationsSchema.parse({
        specializations: [" pasivní domy ", "pasivní domy"],
      }).specializations,
    ).toEqual(["pasivní domy"]);
  });

  it("dostupnost: odmítne neznámou hodnotu", () => {
    expect(
      onboardingAvailabilitySchema.safeParse({ availability: "nope" }).success,
    ).toBe(false);
    expect(
      onboardingAvailabilitySchema.parse({}).availability,
    ).toBeUndefined();
  });
});

describe("onboardingStepSchema", () => {
  it("omezí krok na rozsah 0..4", () => {
    expect(onboardingStepSchema.parse("2")).toBe(2);
    expect(onboardingStepSchema.safeParse(5).success).toBe(false);
    expect(onboardingStepSchema.safeParse(-1).success).toBe(false);
  });
});
