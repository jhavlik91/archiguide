"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveContext } from "@/lib/permissions";
import { switchContext } from "../actions";

const OPTIONS: { value: ActiveContext; label: string; icon: React.ReactNode }[] =
  [
    { value: "client", label: "Klient", icon: <User /> },
    { value: "professional", label: "Profesionál", icon: <Briefcase /> },
  ];

/**
 * Přepínač aktivního kontextu pro účty s klientskou i profesionální rolí
 * (T004). Renderuje se jen tam, kde má smysl (layout ho vloží pro dual-role
 * uživatele). Segmentované tlačítko, plně dostupné z klávesnice i na mobilu.
 */
export function RoleContextSwitcher({ active }: { active: ActiveContext }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Optimistická hodnota, aby přepnutí bylo okamžitě vidět.
  const [optimistic, setOptimistic] = React.useState(active);
  React.useEffect(() => setOptimistic(active), [active]);

  function select(value: ActiveContext) {
    if (value === optimistic || pending) return;
    setOptimistic(value);
    startTransition(async () => {
      const result = await switchContext(value);
      if (!result.ok) {
        setOptimistic(active); // rollback
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Aktivní kontext"
      className="bg-muted inline-flex rounded-md p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = optimistic === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={pending}
            onClick={() => select(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-70 [&_svg]:size-3.5 [&_svg]:shrink-0",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
