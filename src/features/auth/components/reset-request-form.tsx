"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "../actions";
import { FormError } from "./auth-card";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <p className="text-sm">
        Pokud u nás účet s tímto e-mailem existuje, poslali jsme na něj odkaz
        pro obnovení hesla. Zkontrolujte prosím svou schránku.
      </p>
    );
  }

  const error = state?.ok === false ? state.message : null;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Odesílám…" : "Poslat odkaz pro obnovení"}
      </Button>
    </form>
  );
}
