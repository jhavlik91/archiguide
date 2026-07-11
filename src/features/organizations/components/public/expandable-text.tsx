"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Nad tuto délku (znaky) se dlouhý text sbalí a nabídne „Rozbalit". */
const CLAMP_THRESHOLD = 320;

/**
 * Dlouhý popis firmy zobrazí sbalený s možností rozbalit (T010 edge case: dlouhý
 * popis). Krátký text se vykreslí celý bez ovládání. `whitespace-pre-line`
 * zachová odstavce z textarey. Klientská komponenta — jediná interaktivní část.
 */
export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const clampable = text.length > CLAMP_THRESHOLD;

  return (
    <div>
      <p
        className={
          "text-foreground/90 whitespace-pre-line leading-relaxed" +
          (clampable && !expanded ? " line-clamp-6" : "")
        }
      >
        {text}
      </p>
      {clampable && (
        <Button
          variant="link"
          className="mt-1 h-auto px-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Sbalit" : "Rozbalit"}
        </Button>
      )}
    </div>
  );
}
