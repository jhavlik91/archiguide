"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Ovládací lišta exportu briefu (T022 § Main flow 5) — skrývá se při tisku
 * (`print:hidden`). Tlačítko spustí tisk prohlížeče (→ uložit jako PDF stačí pro
 * MVP); přepínač řídí, zda export zahrne SOUKROMÁ pole (přesná adresa) — výchozí
 * je nezahrnovat (export je bez nich, dokud je uživatel vědomě nepřidá).
 */
export function BriefExportToolbar({
  briefId,
  includePrivate,
  hasPrivateData,
}: {
  briefId: string;
  includePrivate: boolean;
  hasPrivateData: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/brief/${briefId}`}>
          <ArrowLeft />
          Zpět na brief
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-4">
        {hasPrivateData ? (
          <Link
            href={`/brief/${briefId}/export${includePrivate ? "" : "?soukrome=1"}`}
            className="flex items-center gap-2 text-sm"
            replace
          >
            <Checkbox checked={includePrivate} tabIndex={-1} />
            Zahrnout soukromá pole (přesná adresa)
          </Link>
        ) : null}
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Tisk / uložit PDF
        </Button>
      </div>
    </div>
  );
}
