"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { type BlockedUserSummary } from "../types";
import { unblockUser } from "../actions";

/**
 * Správa blokovaných uživatelů v nastavení (T031 § Main flow bod 2 — blokace je
 * vratná). Seznam zablokovaných s tlačítkem „Odblokovat"; po odblokování se
 * konverzace vrátí do aktivního inboxu a protistrana zas může psát.
 */
export function BlockedUsersPanel({
  blocked,
}: {
  blocked: BlockedUserSummary[];
}) {
  const router = useRouter();
  const [list, setList] = useState(blocked);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function unblock(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      const res = await unblockUser({ blockedUserId: userId });
      if (res.ok) {
        setList((prev) => prev.filter((b) => b.userId !== userId));
        toast.success("Uživatel byl odblokován.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Odblokování se nepodařilo.");
      }
      setPendingId(null);
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Blokovaní uživatelé
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Blokovaný vám nemůže napsat a jeho konverzaci nevidíte v aktivním inboxu.
          Odblokování je kdykoli možné.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm">
          <ShieldOff className="size-4" />
          Nikoho jste nezablokovali.
        </div>
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {list.map((b) => (
            <li
              key={b.userId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {b.label}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => unblock(b.userId)}
                disabled={pendingId === b.userId}
              >
                {pendingId === b.userId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Odblokovat"
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
