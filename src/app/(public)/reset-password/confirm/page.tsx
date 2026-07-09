import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetConfirmForm } from "@/features/auth/components/reset-confirm-form";

export const metadata: Metadata = {
  title: "Nastavení nového hesla — ArchiGuide",
};

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="Neplatný odkaz"
        footer={
          <Link href="/reset-password" className="text-foreground underline">
            Vyžádat nový odkaz
          </Link>
        }
      >
        <p className="text-sm">
          Odkaz pro obnovení hesla je neúplný. Vyžádejte si prosím nový.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Nové heslo"
      description="Zvolte si nové heslo ke svému účtu."
    >
      <ResetConfirmForm token={token} />
    </AuthCard>
  );
}
