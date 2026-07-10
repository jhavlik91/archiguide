"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PHONE_CODE_LENGTH } from "../constants";
import type { VerificationView, VerificationActionResult } from "../types";
import {
  changeEmailAction,
  confirmPhoneVerification,
  requestPhoneVerification,
  resendEmailVerification,
} from "../actions";

/** Malý stavový štítek ověření pro vlastníka (na settings, ne veřejný odznak). */
function StatusPill({ status }: { status: VerificationView["status"] }) {
  if (status === "verified") {
    return (
      <Badge variant="success" className="gap-1">
        <BadgeCheck className="size-3.5" aria-hidden />
        Ověřeno
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="size-3.5" aria-hidden />
        Čeká na ověření
      </Badge>
    );
  }
  if (status === "expired") {
    return <Badge variant="secondary">Vypršelo</Badge>;
  }
  return <Badge variant="outline">Neověřeno</Badge>;
}

/** Zpracuje výsledek akce: toast + refresh serverových dat při úspěchu. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<VerificationActionResult>,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Hotovo.");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return { pending, run };
}

function EmailSection({ email, view }: { email: string; view: VerificationView }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>E-mail</CardTitle>
          <StatusPill status={view.status} />
        </div>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {view.status !== "verified" ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Ověřte e-mail odkazem, který jsme vám poslali. Nedorazil? Pošleme
              nový.
            </p>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => resendEmailVerification())}
            >
              Znovu odeslat odkaz
            </Button>
          </div>
        ) : null}

        {editing ? (
          <form
            className="space-y-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => changeEmailAction({ email: newEmail }), () => {
                setEditing(false);
                setNewEmail("");
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-email">Nový e-mail</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <p className="text-muted-foreground text-xs">
                Změna e-mailu zruší jeho ověření — nový e-mail bude potřeba ověřit
                znovu.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                Změnit e-mail
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Zrušit
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="px-0"
          >
            Změnit e-mail
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PhoneSection({ view }: { view: VerificationView }) {
  const { pending, run } = useAction();
  const [phone, setPhone] = useState(view.value ?? "");
  const [code, setCode] = useState("");
  // Kód zadáváme, když už existuje čekající výzva nebo jsme ji právě poslali.
  const [codeSent, setCodeSent] = useState(view.status === "pending");

  const verified = view.status === "verified";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Telefon</CardTitle>
          <StatusPill status={view.status} />
        </div>
        <CardDescription>
          {verified
            ? "Telefon je ověřený. Změnou čísla ověření zrušíte."
            : "Ověřte telefon 6místným kódem z SMS."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => requestPhoneVerification({ phone }), () => {
              setCodeSent(true);
              setCode("");
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+420123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {codeSent || verified ? "Poslat nový kód" : "Poslat kód"}
          </Button>
        </form>

        {codeSent && !verified ? (
          <form
            className="space-y-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => confirmPhoneVerification({ code }), () => setCode(""));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="code">Kód z SMS</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={PHONE_CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              {view.attemptsLeft !== null ? (
                <p className="text-muted-foreground text-xs">
                  Zbývá pokusů: {view.attemptsLeft}.
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={pending}>
              Ověřit telefon
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Panel verifikací na stránce Nastavení (T011). Řídí e-mailový a telefonní flow;
 * data o stavu dostává ze serveru a po každé akci je přenačte (`router.refresh`).
 */
export function VerificationPanel({
  email,
  verifications,
}: {
  email: string;
  verifications: VerificationView[];
}) {
  const emailView = verifications.find((v) => v.type === "email");
  const phoneView = verifications.find((v) => v.type === "phone");

  return (
    <div className="space-y-4">
      {emailView ? <EmailSection email={email} view={emailView} /> : null}
      {phoneView ? <PhoneSection view={phoneView} /> : null}
    </div>
  );
}
