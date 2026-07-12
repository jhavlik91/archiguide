"use client";

import { useMemo } from "react";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { parsePortfolioBlocks } from "../../blocks";
import { BlockRenderer } from "../public/block-renderer";
import type { EditorBlock } from "./types";

/**
 * Živý náhled díla v editoru (T013 § Main flow bod 5). Používá TENTÝŽ render jako
 * veřejná stránka (`BlockRenderer`, T016), takže náhled odpovídá publikované verzi
 * (T013 § AC). Bloky projdou strict schématem — neúplné se v náhledu (stejně jako
 * při publikaci) nezobrazí. Přepínač desktop/mobil mění jen šířku plátna.
 */
export function BlockPreview({
  blocks,
  viewport,
}: {
  blocks: EditorBlock[];
  viewport: "desktop" | "mobile";
}) {
  const parsed = useMemo(() => parsePortfolioBlocks(blocks), [blocks]);

  return (
    <div className="bg-muted/40 border-border flex justify-center rounded-lg border p-4">
      <div
        className={cn(
          "bg-background w-full rounded-lg p-5 shadow-sm transition-all",
          viewport === "mobile" ? "max-w-[390px]" : "max-w-3xl",
        )}
      >
        {parsed.length === 0 ? (
          <EmptyState
            icon={<FileQuestion />}
            title="Zatím není co zobrazit"
            description="Přidejte a vyplňte bloky. V náhledu se zobrazí jen dokončené bloky – přesně tak, jak je uvidí návštěvník."
          />
        ) : (
          <BlockRenderer blocks={parsed} />
        )}
      </div>
    </div>
  );
}
