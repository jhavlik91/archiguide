import type { Metadata } from "next";
import { Link2Off, Lock } from "lucide-react";
import { getBriefBySharedToken } from "@/features/brief/service";
import { BriefContentView } from "@/features/brief/components/brief-content-view";

/**
 * Veřejná sdílená stránka briefu (`/sdileny-brief/[token]`, T022 § Main flow 3).
 * Přístup přes token BEZ přihlášení, READ-ONLY, `noindex` (nesmí se dostat do
 * vyhledávačů). Zobrazuje jen zmrazený snapshot bez soukromých polí; odvolaný/
 * neznámý token → „odkaz již není platný" (neprozrazuje, že brief existoval).
 */
export const metadata: Metadata = {
  title: "Sdílený brief — ArchiGuide",
  // Sdílený odkaz se NIKDY neindexuje (T022 § Permissions).
  robots: { index: false, follow: false },
};

export default async function SharedBriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getBriefBySharedToken(token);

  if (!view) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <Link2Off className="text-muted-foreground size-8" />
        <h1 className="text-xl font-semibold">Odkaz již není platný</h1>
        <p className="text-muted-foreground text-sm">
          Tento sdílený odkaz byl odvolán nebo neexistuje. Požádejte odesílatele
          o nový.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm">
        <Lock className="size-4 shrink-0" />
        Sdílený projektový brief — jen ke čtení. Soukromé údaje (přesná adresa)
        a soukromé přílohy nejsou zahrnuty.
      </div>

      <header className="space-y-1">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Projektový brief
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
      </header>

      <BriefContentView content={view.content} />

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        Vytvořeno v ArchiGuide.
      </footer>
    </div>
  );
}
