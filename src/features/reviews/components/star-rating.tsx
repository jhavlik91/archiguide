"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVIEW_RATING_MAX } from "../types";

const SCALE = Array.from({ length: REVIEW_RATING_MAX }, (_, i) => i + 1);

/** Interaktivní výběr 1–5 pro jedno kritérium (formulář hodnocení). */
export function StarRatingInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} z ${REVIEW_RATING_MAX}`}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "size-5",
                n <= value
                  ? "fill-warning text-warning"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Readonly zobrazení hodnocení (karta recenze, agregát). */
export function StarRatingDisplay({
  value,
  size = "sm",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const rounded = Math.round(value);
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={`Hodnocení ${value} z ${REVIEW_RATING_MAX}`}
    >
      {SCALE.map((n) => (
        <Star
          key={n}
          className={cn(
            size === "sm" ? "size-3.5" : "size-4.5",
            n <= rounded ? "fill-warning text-warning" : "text-muted-foreground",
          )}
        />
      ))}
    </div>
  );
}
