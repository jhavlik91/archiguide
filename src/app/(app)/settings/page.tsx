import { auth } from "@/auth";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { listVerifications } from "@/features/verification/service";
import { VerificationBadges } from "@/features/verification/components/verification-badges";
import { VerificationPanel } from "@/features/verification/components/verification-panel";
import type { VerificationType } from "@/features/verification/rules";

/** Hláška po návratu z verifikačního odkazu (`/verify`). */
function VerifyNotice({ emailVerified, error }: { emailVerified: boolean; error?: string }) {
  if (emailVerified) {
    return (
      <div className="border-success/40 bg-success/10 text-success-foreground rounded-lg border px-4 py-3 text-sm">
        E-mail byl úspěšně ověřen.
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
        {error === "expired"
          ? "Ověřovací odkaz vypršel. Nechte si poslat nový níže."
          : "Ověřovací odkaz je neplatný. Nechte si poslat nový níže."}
      </div>
    );
  }
  return null;
}

/**
 * Nastavení účtu. MVP obsahuje verifikaci kontaktů (T011); další sekce doplní
 * pozdější tasky. Dostupné každému přihlášenému uživateli.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ emailVerified?: string; verifyError?: string }>;
}) {
  const params = await searchParams;
  const actor = await requireUser();
  const [verifications, user] = await Promise.all([
    listVerifications(actor.userId),
    db.user.findUnique({
      where: { id: actor.userId },
      select: { email: true },
    }),
  ]);
  const session = await auth();
  const email = user?.email ?? session?.user?.email ?? "";
  const verifiedTypes = verifications
    .filter((v) => v.status === "verified")
    .map((v) => v.type as VerificationType);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ověření kontaktů. Ověřený e-mail a telefon získají odznak na vašem
          profilu.
        </p>
        <VerificationBadges types={verifiedTypes} className="mt-3" />
      </div>
      <VerifyNotice
        emailVerified={params.emailVerified === "1"}
        error={params.verifyError}
      />
      <VerificationPanel email={email} verifications={verifications} />
    </div>
  );
}
