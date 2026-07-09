"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "../validation";
import { resetPassword } from "../actions";
import { FormError } from "./auth-card";

export function ResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(resetPassword, null);

  useEffect(() => {
    if (state?.ok) router.push("/login?reset=1");
  }, [state, router]);

  const error = state?.ok === false ? state.message : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">Nové heslo</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
        <p className="text-muted-foreground text-xs">
          Alespoň {PASSWORD_MIN_LENGTH} znaků.
        </p>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Ukládám…" : "Nastavit nové heslo"}
      </Button>
    </form>
  );
}
