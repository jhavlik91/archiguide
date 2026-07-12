import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGuideAccessor } from "@/features/guide/accessor";
import { getSession } from "@/features/guide/service";
import { GuideRunner } from "@/features/guide/components/guide-runner";

export const metadata: Metadata = {
  title: "Průvodce záměrem — ArchiGuide",
};

/**
 * Runner konkrétní guide session (T018). Načte náhled session pro aktuálního
 * žadatele (přihlášený userId nebo anonymní cookie token). Cizí/neexistující
 * session → zpět na výběr (bez prozrazení, že existuje). Reload uprostřed kroku
 * jen znovu načte perzistovaný stav — proto stačí server render + klient runner.
 */
export default async function GuideSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const accessor = await getGuideAccessor();
  const result = await getSession(sessionId, accessor);
  if (!result.ok) redirect("/guide");

  return <GuideRunner initialView={result.view} />;
}
