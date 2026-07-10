"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  COLLABORATION_FORMS,
  COLLABORATION_FORM_LABELS,
  HEADLINE_MAX_LENGTH,
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
  type Availability,
  type CollaborationForm,
  type PricingModel,
  type ProfessionLink,
} from "../types";
import { canPublish } from "../rules";
import {
  publishProfileAction,
  saveAvailability,
  saveBasics,
  saveExpertise,
  savePricing,
  saveProfessions,
  toggleAcceptingRequests,
  unpublishProfileAction,
} from "../actions";
import type { ProfileActionResult } from "../actions";
import { ListField } from "./list-field";
import {
  ProfessionPicker,
  type CategoryOption,
} from "./profession-picker";

const NONE = "__none__";

export type EditorProfile = {
  status: "draft" | "published";
  /** Veřejný slug (má ho profil až po první publikaci). */
  slug: string | null;
  acceptingRequests: boolean;
  headline: string | null;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  serviceAreas: string[];
  languages: string[];
  yearsOfExperience: number | null;
  specializations: string[];
  projectTypes: string[];
  availability: Availability | null;
  collaborationForms: CollaborationForm[];
  pricingModel: PricingModel | null;
  pricingNote: string | null;
  professions: ProfessionLink[];
};

export function ProfileEditor({
  profile,
  categories,
}: {
  profile: EditorProfile;
  categories: CategoryOption[];
}) {
  const [form, setForm] = useState<EditorProfile>(profile);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof EditorProfile>(key: K, value: EditorProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Spustí server akci a zobrazí zpětnou vazbu (nikdy tiše nespadne). */
  function run(
    action: () => Promise<ProfileActionResult>,
    successMessage: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(successMessage);
      else toast.error(result.message);
    });
  }

  const isPublished = profile.status === "published";
  const publishable = canPublish({
    headline: form.headline,
    professionCount: form.professions.length,
  });

  return (
    <div className="space-y-6">
      {/* Hlavička: stav, publikace, příjem poptávek */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                Můj profil
                <Badge variant={isPublished ? "success" : "secondary"}>
                  {isPublished ? "Publikováno" : "Rozpracováno"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {isPublished
                  ? "Profil je veřejný."
                  : "Draft vidíte jen vy. Publikujte, až budete spokojeni."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {profile.slug && (
                <Button variant="ghost" asChild>
                  <Link
                    href={
                      isPublished
                        ? `/profesional/${profile.slug}`
                        : `/profesional/${profile.slug}?preview=1`
                    }
                  >
                    <ExternalLink className="size-4" />
                    {isPublished ? "Veřejný profil" : "Náhled"}
                  </Link>
                </Button>
              )}
              {isPublished ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(unpublishProfileAction, "Profil skryt (draft).")
                  }
                >
                  <EyeOff className="size-4" /> Skrýt
                </Button>
              ) : (
                <Button
                  disabled={pending || !publishable}
                  onClick={() =>
                    run(publishProfileAction, "Profil publikován.")
                  }
                >
                  <Eye className="size-4" /> Publikovat
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!publishable && !isPublished && (
            <p className="text-muted-foreground text-sm">
              K publikaci doplňte titulek a alespoň jednu profesi.
            </p>
          )}
          {/* Příjem poptávek — nezávislý flag, vyžaduje profesi */}
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="accepting"
              className="mt-0.5"
              checked={form.acceptingRequests}
              disabled={pending}
              onCheckedChange={(c) => {
                const next = c === true;
                // Optimisticky přepni; při zamítnutí serverem (rule guard)
                // vrať zpět, ať UI nelže o uloženém stavu.
                set("acceptingRequests", next);
                startTransition(async () => {
                  const result = await toggleAcceptingRequests({
                    accepting: next,
                  });
                  if (result.ok) {
                    toast.success(
                      next ? "Přijímáte poptávky." : "Příjem poptávek vypnut.",
                    );
                  } else {
                    set("acceptingRequests", !next);
                    toast.error(result.message);
                  }
                });
              }}
            />
            <div>
              <Label htmlFor="accepting" className="font-medium">
                Přijímám poptávky
              </Label>
              <p className="text-muted-foreground text-sm">
                Zapnutelné jen s alespoň jednou profesí.
              </p>
            </div>
            {form.acceptingRequests && (
              <CheckCircle2 className="text-success ml-auto size-5" />
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="basics">
        <TabsList>
          <TabsTrigger value="basics">Základ</TabsTrigger>
          <TabsTrigger value="expertise">Odbornost</TabsTrigger>
          <TabsTrigger value="availability">Dostupnost</TabsTrigger>
          <TabsTrigger value="pricing">Ceny</TabsTrigger>
        </TabsList>

        {/* Základ */}
        <TabsContent value="basics">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="headline">Titulek</Label>
                <Input
                  id="headline"
                  maxLength={HEADLINE_MAX_LENGTH}
                  defaultValue={form.headline ?? ""}
                  placeholder="Např. Architekt se zaměřením na rodinné domy"
                  onChange={(e) => set("headline", e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Max {HEADLINE_MAX_LENGTH} znaků.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photoUrl">Odkaz na fotografii</Label>
                <Input
                  id="photoUrl"
                  type="url"
                  defaultValue={form.photoUrl ?? ""}
                  placeholder="https://…"
                  onChange={(e) => set("photoUrl", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Krátké bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  defaultValue={form.bio ?? ""}
                  onChange={(e) => set("bio", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Lokalita</Label>
                <Input
                  id="location"
                  defaultValue={form.location ?? ""}
                  placeholder="Např. Praha"
                  onChange={(e) => set("location", e.target.value)}
                />
              </div>
              <ListField
                id="serviceAreas"
                label="Region působnosti"
                hint="Praha, Středočeský kraj"
                value={form.serviceAreas}
                onChange={(v) => set("serviceAreas", v)}
              />
              <ListField
                id="languages"
                label="Jazyky"
                hint="čeština, angličtina"
                value={form.languages}
                onChange={(v) => set("languages", v)}
              />
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      saveBasics({
                        headline: form.headline ?? "",
                        photoUrl: form.photoUrl ?? "",
                        bio: form.bio ?? "",
                        location: form.location ?? "",
                        serviceAreas: form.serviceAreas,
                        languages: form.languages,
                      }),
                    "Základní informace uloženy.",
                  )
                }
              >
                Uložit
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Odbornost */}
        <TabsContent value="expertise">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Profese</p>
                  <p className="text-muted-foreground text-sm">
                    Vyberte hlavní profesi a případně vedlejší.
                  </p>
                </div>
                <ProfessionPicker
                  categories={categories}
                  value={form.professions}
                  onChange={(v) => set("professions", v)}
                />
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => saveProfessions({ professions: form.professions }),
                      "Profese uloženy.",
                    )
                  }
                >
                  Uložit profese
                </Button>
              </div>

              <hr />

              <div className="space-y-1.5">
                <Label htmlFor="years">Roky praxe</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  max={80}
                  defaultValue={form.yearsOfExperience ?? ""}
                  onChange={(e) =>
                    set(
                      "yearsOfExperience",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
              <ListField
                id="specializations"
                label="Specializace"
                hint="pasivní domy, rekonstrukce"
                value={form.specializations}
                onChange={(v) => set("specializations", v)}
              />
              <ListField
                id="projectTypes"
                label="Typy projektů"
                hint="novostavby, interiéry"
                value={form.projectTypes}
                onChange={(v) => set("projectTypes", v)}
              />
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      saveExpertise({
                        yearsOfExperience: form.yearsOfExperience ?? undefined,
                        specializations: form.specializations,
                        projectTypes: form.projectTypes,
                      }),
                    "Odbornost uložena.",
                  )
                }
              >
                Uložit odbornost
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dostupnost */}
        <TabsContent value="availability">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="availability">Dostupnost</Label>
                <Select
                  value={form.availability ?? NONE}
                  onValueChange={(v) =>
                    set(
                      "availability",
                      v === NONE ? null : (v as Availability),
                    )
                  }
                >
                  <SelectTrigger id="availability">
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
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Forma spolupráce</legend>
                {COLLABORATION_FORMS.map((f) => {
                  const checked = form.collaborationForms.includes(f);
                  return (
                    <div key={f} className="flex items-center gap-2">
                      <Checkbox
                        id={`cf-${f}`}
                        checked={checked}
                        onCheckedChange={(c) =>
                          set(
                            "collaborationForms",
                            c === true
                              ? [...form.collaborationForms, f]
                              : form.collaborationForms.filter((x) => x !== f),
                          )
                        }
                      />
                      <Label htmlFor={`cf-${f}`} className="font-normal">
                        {COLLABORATION_FORM_LABELS[f]}
                      </Label>
                    </div>
                  );
                })}
              </fieldset>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      saveAvailability({
                        availability: form.availability ?? undefined,
                        collaborationForms: form.collaborationForms,
                      }),
                    "Dostupnost uložena.",
                  )
                }
              >
                Uložit dostupnost
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ceny */}
        <TabsContent value="pricing">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="pricingModel">Cenový model</Label>
                <Select
                  value={form.pricingModel ?? NONE}
                  onValueChange={(v) =>
                    set(
                      "pricingModel",
                      v === NONE ? null : (v as PricingModel),
                    )
                  }
                >
                  <SelectTrigger id="pricingModel">
                    <SelectValue placeholder="Nezadáno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nezadáno</SelectItem>
                    {PRICING_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PRICING_MODEL_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pricingNote">Poznámka k cenám</Label>
                <Input
                  id="pricingNote"
                  defaultValue={form.pricingNote ?? ""}
                  placeholder="Např. od 1 500 Kč/h"
                  onChange={(e) => set("pricingNote", e.target.value)}
                />
              </div>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      savePricing({
                        pricingModel: form.pricingModel ?? undefined,
                        pricingNote: form.pricingNote ?? "",
                      }),
                    "Ceny uloženy.",
                  )
                }
              >
                Uložit ceny
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
