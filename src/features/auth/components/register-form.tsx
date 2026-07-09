"use client";

import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PASSWORD_MIN_LENGTH } from "../validation";
import { register } from "../actions";
import { safeReturnUrl } from "../return-url";
import { FormError } from "./auth-card";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnUrl = safeReturnUrl(params.get("returnUrl"));

  const [state, action, pending] = useActionState(register, null);

  useEffect(() => {
    if (state?.ok) router.push(returnUrl);
  }, [state, returnUrl, router]);

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
      <div className="space-y-2">
        <Label htmlFor="password">Heslo</Label>
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

      <div className="flex items-start gap-2">
        <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" />
        <Label htmlFor="acceptTerms" className="leading-snug font-normal">
          Souhlasím s{" "}
          <Link href="/terms" className="underline">
            podmínkami
          </Link>{" "}
          a{" "}
          <Link href="/privacy" className="underline">
            zpracováním údajů
          </Link>
          .
        </Label>
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Zakládám účet…" : "Vytvořit účet"}
      </Button>
    </form>
  );
}
