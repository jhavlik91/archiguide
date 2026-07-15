"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateNotificationPreferences } from "../actions";
import { groupDefaultChannels } from "../rules";
import {
  EMAIL_FREQUENCIES,
  NOTIFICATION_GROUPS,
  NOTIFICATION_GROUP_LABELS,
  type EmailFrequency,
  type NotificationGroup,
  type NotificationPreferences,
} from "../types";

const FREQUENCY_LABELS: Record<EmailFrequency, string> = {
  immediate: "Okamžitě",
  daily: "Denní souhrn",
  weekly: "Týdenní souhrn",
};

type GroupChannels = Record<NotificationGroup, { in_app: boolean; email: boolean }>;

/**
 * Výchozí stav zaškrtávátek, dokud uživatel nic neuloží: nevychází z pevného
 * `true`, ale z default politiky katalogu za danou skupinu (`groupDefaultChannels`).
 * Jinak by needitovaný formulář po prvním „Uložit" tiše zapnul e-mail i tam,
 * kde ho politika vůbec nenabízí (zprávy mají e-mail jen jako opt-in).
 */
function buildInitialGroups(prefs: NotificationPreferences): GroupChannels {
  const result = {} as GroupChannels;
  for (const group of NOTIFICATION_GROUPS) {
    const stored = prefs.groups?.[group] ?? {};
    const defaults = groupDefaultChannels(group);
    result[group] = {
      in_app: stored.in_app ?? defaults.includes("in_app"),
      email: stored.email ?? defaults.includes("email"),
    };
  }
  return result;
}

/**
 * Preferenční UI notifikací (T033 § Main flow bod 3): matice skupina × kanál +
 * frekvence e-mailu. Kritické servisní události (schválení/zamítnutí
 * verifikace) dorazí do aplikace vždy bez ohledu na přepnutí zde — vynucuje to
 * server (`resolveChannels`), checkbox proto zůstává funkční, jen s vysvětlující
 * poznámkou u skupiny Verifikace.
 */
export function PreferencesPanel({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groups, setGroups] = useState<GroupChannels>(() =>
    buildInitialGroups(preferences),
  );
  const [frequency, setFrequency] = useState<EmailFrequency>(
    preferences.emailFrequency ?? "immediate",
  );

  function toggle(group: NotificationGroup, channel: "in_app" | "email") {
    setGroups((prev) => ({
      ...prev,
      [group]: { ...prev[group], [channel]: !prev[group][channel] },
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateNotificationPreferences({ groups, emailFrequency: frequency });
      if (result.ok) {
        toast.success("Preference uloženy.");
        router.refresh();
      } else {
        toast.error("Uložení se nepovedlo, zkuste to prosím znovu.");
      }
    });
  }

  return (
    <Card id="notifications">
      <CardHeader>
        <CardTitle>Notifikace</CardTitle>
        <CardDescription>
          Kanál a frekvence za jednotlivé skupiny událostí. In-app kanál nejde
          vypnout u kritických servisních zpráv (např. výsledek verifikace).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-2 font-normal">Skupina</th>
                <th className="pb-2 text-center font-normal">V aplikaci</th>
                <th className="pb-2 text-center font-normal">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_GROUPS.map((group) => (
                <tr key={group} className="border-t">
                  <td className="py-3">
                    <div>{NOTIFICATION_GROUP_LABELS[group]}</div>
                    {group === "verification" ? (
                      <p className="text-muted-foreground text-xs">
                        Schválení, zamítnutí a vypršení verifikace dorazí do
                        aplikace vždy.
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      aria-label={`${NOTIFICATION_GROUP_LABELS[group]} — v aplikaci`}
                      checked={groups[group].in_app}
                      onCheckedChange={() => toggle(group, "in_app")}
                    />
                  </td>
                  <td className="py-3 text-center">
                    <Checkbox
                      aria-label={`${NOTIFICATION_GROUP_LABELS[group]} — e-mail`}
                      checked={groups[group].email}
                      onCheckedChange={() => toggle(group, "email")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>Frekvence e-mailu</Label>
          <RadioGroup
            value={frequency}
            onValueChange={(value) => setFrequency(value as EmailFrequency)}
          >
            {EMAIL_FREQUENCIES.map((value) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem value={value} id={`frequency-${value}`} />
                <Label htmlFor={`frequency-${value}`} className="font-normal">
                  {FREQUENCY_LABELS[value]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Button onClick={save} disabled={pending}>
          Uložit preference
        </Button>
      </CardContent>
    </Card>
  );
}
