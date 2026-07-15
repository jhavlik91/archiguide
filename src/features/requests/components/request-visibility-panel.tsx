"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { setRequestVisibilityAction } from "../actions";
import { publicRequestPath } from "../paths";
import { RequestPrivacyWarningDialog } from "./privacy-warning-dialog";
import type { PrivacyWarningKind } from "@/features/brief/privacy";
import {
  SELECTABLE_REQUEST_VISIBILITIES,
  type RequestView,
  type SelectableRequestVisibility,
} from "../types";

const VISIBILITY_OPTIONS: {
  value: SelectableRequestVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: "private",
    label: "Soukromá",
    description: "Vidíte jen vy a profesionálové, které pozvete.",
  },
  {
    value: "public",
    label: "Veřejná",
    description:
      "Anonymizovanou verzi (bez adresy, telefonu, e-mailu a vaší identity) uvidí kdokoli.",
  },
];

/**
 * Panel viditelnosti poptávky (T025 § Main flow 1, 4, 6). Vlastník volí mezi
 * `private`/`public`; zpřístupňující změna projde sanitizační kontrolou
 * (`detectPrivacyWarnings`) a vyžádá si explicitní potvrzení (main flow bod 4,
 * zadani/05 — „publikace identity u anonymizované poptávky" = citlivá akce).
 * Odkaz „Náhled veřejné verze" (bod 6) vede na stejnou anonymizovanou projekci,
 * kterou vlastník smí vidět i v draftu (`canReadRequestPublicView` override).
 */
export function RequestVisibilityPanel({ request }: { request: RequestView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [warnings, setWarnings] = useState<PrivacyWarningKind[] | null>(null);
  const [pendingChoice, setPendingChoice] =
    useState<SelectableRequestVisibility | null>(null);

  const current: SelectableRequestVisibility = (
    SELECTABLE_REQUEST_VISIBILITIES as readonly string[]
  ).includes(request.visibility)
    ? (request.visibility as SelectableRequestVisibility)
    : "private";

  function apply(next: SelectableRequestVisibility, confirmed: boolean) {
    startTransition(async () => {
      const res = await setRequestVisibilityAction(request.id, next, confirmed);
      if (res.ok) {
        setWarnings(null);
        setPendingChoice(null);
        toast.success(
          next === "public"
            ? "Poptávka je teď veřejná."
            : "Poptávka je teď soukromá.",
        );
        router.refresh();
        return;
      }
      if ("needsConfirmation" in res) {
        setPendingChoice(next);
        setWarnings(res.warnings);
        return;
      }
      toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {current === "public" ? (
              <Globe className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            Viditelnost poptávky
          </h2>
          <p className="text-muted-foreground text-sm">
            Nikdy se automaticky nezveřejní přesná adresa, telefon, e-mail ani
            vaše identita — anonymizovaná projekce je vždy jen výběr povolených
            polí.
          </p>
        </div>

        <RadioGroup
          value={current}
          onValueChange={(v) => apply(v as SelectableRequestVisibility, false)}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`req-visibility-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem
                id={`req-visibility-${option.value}`}
                value={option.value}
                disabled={pending}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <Label
                  htmlFor={`req-visibility-${option.value}`}
                  className="cursor-pointer text-sm font-medium"
                >
                  {option.label}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {option.description}
                </p>
              </span>
            </label>
          ))}
        </RadioGroup>

        <Button variant="outline" asChild>
          <Link href={publicRequestPath(request.id)} target="_blank">
            <Eye />
            Náhled: takhle vidí poptávku profesionál
          </Link>
        </Button>
      </CardContent>

      <RequestPrivacyWarningDialog
        warnings={warnings}
        pending={pending}
        onCancel={() => {
          setWarnings(null);
          setPendingChoice(null);
        }}
        onConfirm={() => pendingChoice && apply(pendingChoice, true)}
      />
    </Card>
  );
}
