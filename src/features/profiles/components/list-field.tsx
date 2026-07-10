"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Rozdělí text oddělený čárkami na očištěný seznam bez prázdných/duplicit. */
export function parseList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ];
}

/**
 * Jednoduché pole pro seznam hodnot oddělených čárkou (regiony, jazyky,
 * specializace…). Drží syrový text lokálně a rodiči hlásí rozparsovaný seznam.
 */
export function ListField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        defaultValue={value.join(", ")}
        placeholder={hint}
        onChange={(e) => onChange(parseList(e.target.value))}
      />
      <p className="text-muted-foreground text-xs">Oddělte čárkou.</p>
    </div>
  );
}
