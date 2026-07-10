"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { NAME_MAX_LENGTH } from "../types";
import { updateOrganizationAction } from "../actions";

export type OrgProfileData = {
  name: string;
  logoUrl: string | null;
  description: string | null;
  businessId: string | null;
  location: string | null;
  serviceAreas: string[];
  specializations: string[];
};

/** Rozdělí čárkami oddělený vstup na deduplikovaný seznam bez prázdných. */
function toList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Editace firemního profilu (T009). Needitující člen (member) i systémový
 * návštěvník vidí pole jen ke čtení — zápis je gated přes `canEdit` a znovu
 * ověřen serverovou akcí (obrana do hloubky).
 */
export function OrganizationProfileEditor({
  orgId,
  profile,
  canEdit,
}: {
  orgId: string;
  profile: OrgProfileData;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    name: profile.name,
    logoUrl: profile.logoUrl ?? "",
    description: profile.description ?? "",
    businessId: profile.businessId ?? "",
    location: profile.location ?? "",
    serviceAreas: profile.serviceAreas.join(", "),
    specializations: profile.specializations.join(", "),
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateOrganizationAction(orgId, {
        name: form.name,
        logoUrl: form.logoUrl,
        description: form.description,
        businessId: form.businessId,
        location: form.location,
        serviceAreas: toList(form.serviceAreas),
        specializations: toList(form.specializations),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.duplicateBusinessId) {
        toast.warning("Jiná firma má stejné IČO. Zkontrolujte duplicitu.");
      }
      toast.success("Firemní profil uložen.");
    });
  }

  const disabled = !canEdit || pending;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {!canEdit && (
          <p className="text-muted-foreground text-sm">
            Firemní profil můžete jen prohlížet. Úpravy provádí vlastník, admin
            nebo editor.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">Název firmy</Label>
          <Input
            id="name"
            maxLength={NAME_MAX_LENGTH}
            value={form.name}
            disabled={disabled}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Odkaz na logo</Label>
          <Input
            id="logoUrl"
            type="url"
            value={form.logoUrl}
            disabled={disabled}
            placeholder="https://…"
            onChange={(e) => set("logoUrl", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Popis</Label>
          <Textarea
            id="description"
            rows={4}
            value={form.description}
            disabled={disabled}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="businessId">IČO</Label>
            <Input
              id="businessId"
              value={form.businessId}
              disabled={disabled}
              placeholder="12345678"
              onChange={(e) => set("businessId", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Sídlo</Label>
            <Input
              id="location"
              value={form.location}
              disabled={disabled}
              placeholder="Např. Praha"
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serviceAreas">Regiony působnosti</Label>
          <Input
            id="serviceAreas"
            value={form.serviceAreas}
            disabled={disabled}
            placeholder="Praha, Středočeský kraj"
            onChange={(e) => set("serviceAreas", e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Oddělte čárkami.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="specializations">Specializace</Label>
          <Input
            id="specializations"
            value={form.specializations}
            disabled={disabled}
            placeholder="novostavby, rekonstrukce"
            onChange={(e) => set("specializations", e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Oddělte čárkami.</p>
        </div>
        {canEdit && (
          <Button onClick={save} disabled={disabled}>
            {pending ? "Ukládám…" : "Uložit profil"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
