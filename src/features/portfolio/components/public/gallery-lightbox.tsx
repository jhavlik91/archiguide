"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PortfolioImageRef } from "../../blocks";

/**
 * Galerie s lightboxem (T016). Mřížka náhledů; kliknutí otevře celoobrazovkový
 * prohlížeč s navigací (šipky, klávesnice, Escape). Funguje na mobilu i klávesnicí.
 */
export function GalleryLightbox({ images }: { images: PortfolioImageRef[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null
          ? current
          : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIndex, close, move]);

  const active = openIndex === null ? null : images[openIndex];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((image, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group focus-visible:ring-ring block aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted focus:outline-none focus-visible:ring-2"
              aria-label={image.alt ? `Zvětšit: ${image.alt}` : "Zvětšit obrázek"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt ?? ""}
                loading="lazy"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prohlížeč obrázků"
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={close}
        >
          <div className="flex justify-end p-3">
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Zavřít"
              className="rounded-full p-2 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-6" />
            </button>
          </div>

          <div
            className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-2 sm:gap-4 sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Předchozí"
                className="shrink-0 rounded-full p-2 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="size-7" />
              </button>
            )}
            <figure className="flex min-h-0 flex-1 flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={active.alt ?? ""}
                className="max-h-[80vh] max-w-full rounded object-contain"
              />
              {active.caption && (
                <figcaption className="mt-3 max-w-2xl text-center text-sm text-white/80">
                  {active.caption}
                </figcaption>
              )}
            </figure>
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Další"
                className="shrink-0 rounded-full p-2 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="size-7" />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <p className="pb-4 text-center text-sm text-white/70">
              {openIndex! + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}
