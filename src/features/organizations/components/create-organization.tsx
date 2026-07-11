"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { NAME_MAX_LENGTH } from "../types";
import { createOrganizationAction } from "../actions";

/**
 * Založení firmy: název (povinný) a volitelné IČO. Zakladatel se stává ownerem.
 * Duplicitní IČO je jen upozornění (ne blok) — firma přesto vznikne a přejdeme
 * na její detail.
 */
export function CreateOrganization() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createOrganizationAction({ name, businessId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.duplicateBusinessId) {
        toast.warning(
          "Firma se stejným IČO už existuje. Zkontrolujte duplicitu.",
        );
      }
      toast.success("Firma založena.");
      router.push(`/organizations/${result.orgId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <Building2 className="size-5" />
        </div>
        <CardTitle>Založit firmu</CardTitle>
        <CardDescription>
          Vytvořte firemní profil a spravujte tým. Stanete se vlastníkem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Název firmy</Label>
          <Input
            id="org-name"
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Studio ABC"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-ico">IČO (volitelné)</Label>
          <Input
            id="org-ico"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="12345678"
          />
        </div>
        <Button onClick={submit} disabled={pending || name.trim().length === 0}>
          {pending ? "Zakládám…" : "Založit firmu"}
        </Button>
      </CardContent>
    </Card>
  );
}
