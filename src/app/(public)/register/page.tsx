import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";
import {
  GoogleButton,
  OrSeparator,
} from "@/features/auth/components/google-button";
import { googleEnabled } from "@/auth.config";

export const metadata: Metadata = { title: "Registrace — ArchiGuide" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Vytvořit účet"
      description="Registrace je zdarma a zabere minutu."
      footer={
        <>
          Už máte účet?{" "}
          <Link href="/login" className="text-foreground underline">
            Přihlaste se
          </Link>
        </>
      }
    >
      {googleEnabled ? (
        <>
          <GoogleButton label="Registrovat přes Google" />
          <OrSeparator />
        </>
      ) : null}
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
