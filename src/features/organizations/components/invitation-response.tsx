"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { acceptInvitationAction, declineInvitationAction } from "../actions";

/**
 * Přijetí/odmítnutí pozvánky do firmy (T009). Zobrazuje se přihlášenému
 * uživateli, jehož e-mail odpovídá pozvánce. Po přijetí přejde na detail firmy.
 */
export function InvitationResponse({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (result.ok) {
        toast.success("Pozvánku jste přijali.");
        router.push(`/organizations/${result.orgId}`);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function decline() {
    startTransition(async () => {
      const result = await declineInvitationAction(token);
      if (result.ok) {
        toast.success("Pozvánku jste odmítli.");
        router.push("/organizations");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex gap-3">
      <Button onClick={accept} disabled={pending}>
        <Check className="size-4" /> Přijmout
      </Button>
      <Button variant="outline" onClick={decline} disabled={pending}>
        <X className="size-4" /> Odmítnout
      </Button>
    </div>
  );
}
