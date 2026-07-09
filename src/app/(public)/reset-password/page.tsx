import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetRequestForm } from "@/features/auth/components/reset-request-form";

export const metadata: Metadata = { title: "Obnovení hesla — ArchiGuide" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Obnovení hesla"
      description="Zadejte e-mail a pošleme vám odkaz pro nastavení nového hesla."
      footer={
        <Link href="/login" className="text-foreground underline">
          Zpět na přihlášení
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
