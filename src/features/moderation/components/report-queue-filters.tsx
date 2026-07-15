"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATES,
  REPORT_STATE_LABELS,
  REPORT_TARGET_TYPES,
  REPORT_TARGET_TYPE_LABELS,
  type ReportReason,
  type ReportState,
  type ReportTargetType,
} from "../types";

/** Radix Select nepovoluje prázdnou hodnotu položky — sentinel pro „vše". */
const ANY = "__any__";

/**
 * Filtry moderační fronty (T036 § Main flow bod 4: stav, typ, důvod).
 * URL-persistované (sdílitelný odkaz na konkrétní pohled fronty).
 */
export function ReportQueueFilters({
  state,
  targetType,
  reason,
}: {
  state?: ReportState;
  targetType?: ReportTargetType;
  reason?: ReportReason;
}) {
  const router = useRouter();

  function update(key: "state" | "targetType" | "reason", value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === ANY) params.delete(key);
    else params.set(key, value);
    router.push(`/admin/reports?${params.toString()}`);
  }

  const hasFilters = Boolean(state || targetType || reason);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={state ?? ANY} onValueChange={(v) => update("state", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Stav" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Všechny stavy</SelectItem>
          {REPORT_STATES.map((s) => (
            <SelectItem key={s} value={s}>
              {REPORT_STATE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={targetType ?? ANY}
        onValueChange={(v) => update("targetType", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Typ cíle" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Všechny typy</SelectItem>
          {REPORT_TARGET_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {REPORT_TARGET_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={reason ?? ANY} onValueChange={(v) => update("reason", v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Důvod" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Všechny důvody</SelectItem>
          {REPORT_REASONS.map((r) => (
            <SelectItem key={r} value={r}>
              {REPORT_REASON_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/reports")}
        >
          Zrušit filtry
        </Button>
      ) : null}
    </div>
  );
}
