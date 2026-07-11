"use client";

import { useRef, useState } from "react";
import type { PortfolioImageRef } from "../../blocks";

/**
 * Before/after slider (T016). Dvě obrázkové vrstvy nad sebou; „after" se odkrývá
 * podle pozice dělítka. Ovládání je duální: tažení po ploše (pointer, funguje na
 * mobilu) i skrytý `range` input (klávesnice a přístupnost). Pozice je v procentech.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Před",
  afterLabel = "Po",
}: {
  before: PortfolioImageRef;
  after: PortfolioImageRef;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    setPosition(Math.min(100, Math.max(0, ratio * 100)));
  }

  return (
    <figure className="space-y-2">
      <div
        ref={containerRef}
        className="relative aspect-[3/2] w-full touch-none overflow-hidden rounded-lg bg-muted select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) updateFromClientX(e.clientX);
        }}
      >
        {/* Spodní vrstva: „po" (odkrytá zprava) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after.url}
          alt={after.alt ?? afterLabel}
          className="absolute inset-0 size-full object-cover"
          draggable={false}
          loading="lazy"
        />
        {/* Horní vrstva: „před" (oříznutá dělítkem) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before.url}
          alt={before.alt ?? beforeLabel}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
          loading="lazy"
        />

        {/* Popisky rohů */}
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {beforeLabel}
        </span>
        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {afterLabel}
        </span>

        {/* Dělítko + úchyt */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-xs text-black shadow">
            ⇔
          </div>
        </div>

        {/* Přístupné ovládání (klávesnice); vizuálně skryté, ale plně ovladatelné */}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(position)}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Porovnání před a po"
          className="absolute inset-x-0 bottom-0 w-full cursor-ew-resize opacity-0"
        />
      </div>
      {(before.caption || after.caption) && (
        <figcaption className="text-muted-foreground text-sm">
          {before.caption ?? after.caption}
        </figcaption>
      )}
    </figure>
  );
}
