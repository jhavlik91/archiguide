import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import {
  GoogleButton,
  OrSeparator,
} from "@/features/auth/components/google-button";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Přihlášení — ArchiGuide" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Přihlášení"
      description="Vítejte zpět v ArchiGuide."
      footer={
        <>
          Nemáte účet?{" "}
          <Link href="/register" className="text-foreground underline">
            Zaregistrujte se
          </Link>
        </>
      }
    >
      {googleEnabled ? (
        <>
          <GoogleButton />
          <OrSeparator />
        </>
      ) : null}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
