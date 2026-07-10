import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * CTA „Kontaktovat" (T008). Kontaktní údaje se nikdy nezobrazují (private by
 * default) — komunikace půjde přes messaging (T030). Nepřihlášený návštěvník
 * dostane výzvu k registraci; přihlášený vidí slot, který se napojí v T030.
 */
export function ContactCta({
  isAuthenticated,
  acceptingRequests,
}: {
  isAuthenticated: boolean;
  acceptingRequests: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kontaktovat</CardTitle>
        <CardDescription>
          {acceptingRequests
            ? "Profesionál aktuálně přijímá nové poptávky."
            : "Napište profesionálovi přes ArchiGuide — bez sdílení kontaktů."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAuthenticated ? (
          // Slot pro messaging (T030) — zatím bez cílové akce, ať UI nelže.
          <>
            <Button className="w-full" disabled>
              <MessageSquare className="size-4" /> Kontaktovat
            </Button>
            <p className="text-muted-foreground text-xs">
              Zprávy budou brzy dostupné.
            </p>
          </>
        ) : (
          <>
            <Button className="w-full" asChild>
              <Link href="/register">Zaregistrovat se a kontaktovat</Link>
            </Button>
            <p className="text-muted-foreground text-xs">
              Už máte účet?{" "}
              <Link href="/login" className="hover:text-foreground underline">
                Přihlaste se
              </Link>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
