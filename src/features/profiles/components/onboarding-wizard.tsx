"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  type Availability,
  type ProfessionLink,
} from "../types";
import {
  saveOnboardingAvailability,
  saveOnboardingLocation,
  saveOnboardingSpecializations,
  saveOnboardingStep,
  saveProfessions,
} from "../actions";
import type { ProfileActionResult } from "../actions";
import { ListField } from "./list-field";
import {
  ProfessionPicker,
  type CategoryOption,
} from "./profession-picker";

const NONE = "__none__";

/** Kroky wizardu dle legacy-master-spec §55 (redukce v rámci T007 scope). */
const STEPS = ["Profese", "Lokalita", "Specializace", "Dostupnost"] as const;

export type OnboardingInitial = {
  professions: ProfessionLink[];
  location: string | null;
  specializations: string[];
  availability: Availability | null;
  onboardingStep: number;
};

export function OnboardingWizard({
  initial,
  categories,
}: {
  initial: OnboardingInitial;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(
    Math.min(initial.onboardingStep, STEPS.length - 1),
  );
  const [professions, setProfessions] = useState(initial.professions);
  const [location, setLocation] = useState(initial.location ?? "");
  const [specializations, setSpecializations] = useState(initial.specializations);
  const [availability, setAvailability] = useState<Availability | null>(
    initial.availability,
  );

  /**
   * Uloží data kroku (pokud jsou) a posune se dál. Průběžné ukládání: i po
   * odchodu se draft zachová a při návratu wizard pokračuje (onboardingStep).
   */
  function advance(save: (() => Promise<ProfileActionResult>) | null) {
    startTransition(async () => {
      if (save) {
        const result = await save();
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      }
      const nextStep = step + 1;
      await saveOnboardingStep(Math.min(nextStep, STEPS.length));
      if (nextStep >= STEPS.length) {
        toast.success("Základ profilu je hotový. Doplňte detaily a publikujte.");
        router.push("/profile");
        return;
      }
      setStep(nextStep);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Krok {step + 1} ze {STEPS.length}
        </CardDescription>
        <CardTitle>{STEPS[step]}</CardTitle>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                "h-1.5 flex-1 rounded-full " +
                (i <= step ? "bg-primary" : "bg-muted")
              }
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Vyberte hlavní profesi (hvězda) a případně vedlejší.
            </p>
            <ProfessionPicker
              categories={categories}
              value={professions}
              onChange={setProfessions}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="ob-location">Lokalita</Label>
            <Input
              id="ob-location"
              value={location}
              placeholder="Např. Praha"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <ListField
            id="ob-specializations"
            label="Specializace"
            hint="pasivní domy, rekonstrukce"
            value={specializations}
            onChange={setSpecializations}
          />
        )}

        {step === 3 && (
          <div className="space-y-1.5">
            <Label htmlFor="ob-availability">Dostupnost</Label>
            <Select
              value={availability ?? NONE}
              onValueChange={(v) =>
                setAvailability(v === NONE ? null : (v as Availability))
              }
            >
              <SelectTrigger id="ob-availability">
                <SelectValue placeholder="Nezadáno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nezadáno</SelectItem>
                {AVAILABILITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AVAILABILITY_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => advance(null)}
          >
            Přeskočit
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => advance(stepSave())}
          >
            {step === STEPS.length - 1 ? "Dokončit" : "Uložit a pokračovat"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  /** Vrátí akci ukládající data aktuálního kroku. */
  function stepSave(): () => Promise<ProfileActionResult> {
    switch (step) {
      case 0:
        return () => saveProfessions({ professions });
      case 1:
        return () => saveOnboardingLocation({ location });
      case 2:
        return () => saveOnboardingSpecializations({ specializations });
      default:
        return () =>
          saveOnboardingAvailability({ availability: availability ?? undefined });
    }
  }
}
