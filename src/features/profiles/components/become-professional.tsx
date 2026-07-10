"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { claimRole } from "@/features/roles/actions";

/**
 * Self-service přechod klienta na profesionála (T004 § Validation). Precondition
 * profilu (T007) je role `professional`; tady si ji uživatel přidělí a rovnou
 * pokračuje na onboarding.
 */
export function BecomeProfessional() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function become() {
    startTransition(async () => {
      const result = await claimRole("professional");
      if (result.ok) {
        router.push("/profile/onboarding");
        router.refresh();
      } else {
        toast.error("Nepodařilo se aktivovat profesionální účet.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <Briefcase className="size-5" />
        </div>
        <CardTitle>Staňte se profesionálem</CardTitle>
        <CardDescription>
          Založte si profesionální profil a začněte přijímat poptávky. Vyplnění
          je postupné, kdykoli se můžete vrátit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={become} disabled={pending}>
          {pending ? "Aktivuji…" : "Aktivovat profesionální účet"}
        </Button>
      </CardContent>
    </Card>
  );
}
