import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Hranice pro `forbidden()` (HTTP 403). Zobrazí se, když přihlášený uživatel
 * nemá oprávnění na danou routu — typicky non-admin na `(admin)` (T004).
 */
export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center p-6">
      <EmptyState
        icon={<ShieldX />}
        title="Nemáte oprávnění"
        description="Na tuto stránku nemáte přístup. Pokud si myslíte, že jde o chybu, obraťte se na správce."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Zpět do aplikace</Link>
          </Button>
        }
      />
    </main>
  );
}
