"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, reactivateAndLogin } from "../actions";
import { FormError } from "./auth-card";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnUrl = params.get("returnUrl") || "/dashboard";
  const justReset = params.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [state, action, pending] = useActionState(login, null);
  const [reactState, reactAction, reactPending] = useActionState(
    reactivateAndLogin,
    null,
  );

  const ok = state?.ok || reactState?.ok;
  useEffect(() => {
    if (ok) router.push(returnUrl);
  }, [ok, returnUrl, router]);

  const deactivated = state?.ok === false && state.error === "deactivated";
  const error =
    reactState?.ok === false
      ? reactState.message
      : state?.ok === false && !deactivated
        ? state.message
        : null;

  return (
    <div className="space-y-4">
      {justReset ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Heslo bylo změněno. Přihlaste se novým heslem.
        </p>
      ) : null}

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Heslo</Label>
            <Link
              href="/reset-password"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Zapomenuté heslo?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <FormError>{error}</FormError> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Přihlašuji…" : "Přihlásit se"}
        </Button>
      </form>

      {deactivated ? (
        <form action={reactAction} className="space-y-2">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <p className="text-sm">{state.message}</p>
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={reactPending}
          >
            {reactPending ? "Reaktivuji…" : "Reaktivovat a přihlásit"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
