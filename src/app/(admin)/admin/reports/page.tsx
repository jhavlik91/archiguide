import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { P_REPORT_QUEUE } from "@/features/moderation/permissions";
import { listReports } from "@/features/moderation/service";
import { ReportQueueFilters } from "@/features/moderation/components/report-queue-filters";
import { formatDateTime } from "@/features/moderation/components/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  REPORT_REASON_LABELS,
  REPORT_STATES,
  REPORT_STATE_LABELS,
  REPORT_TARGET_TYPES,
  REPORT_TARGET_TYPE_LABELS,
  REPORT_REASONS,
} from "@/features/moderation/types";

/** Moderační fronta (T036 § Main flow bod 4): výpis reportů s filtry, nejstarší první. */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission(P_REPORT_QUEUE);
  const sp = await searchParams;

  const state = isOneOf(sp.state, REPORT_STATES) ? sp.state : undefined;
  const targetType = isOneOf(sp.targetType, REPORT_TARGET_TYPES)
    ? sp.targetType
    : undefined;
  const reason = isOneOf(sp.reason, REPORT_REASONS) ? sp.reason : undefined;

  const items = await listReports({ state, targetType, reason });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nahlášení</h1>
        <p className="text-muted-foreground text-sm">
          Moderační fronta — řazeno od nejstaršího nahlášení.
        </p>
      </div>

      <ReportQueueFilters
        state={state}
        targetType={targetType}
        reason={reason}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert />}
          title="Fronta je prázdná"
          description="Žádné nahlášení neodpovídá zvoleným filtrům."
        />
      ) : (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reports/${r.id}`}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {REPORT_TARGET_TYPE_LABELS[r.targetType]}
                    </Badge>
                    <span className="font-medium">
                      {REPORT_REASON_LABELS[r.reason]}
                    </span>
                    {r.reporterCount > 1 ? (
                      <Badge>{r.reporterCount}× nahlášeno</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Založeno {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <Badge variant={r.state === "open" ? "warning" : "outline"}>
                  {REPORT_STATE_LABELS[r.state]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function isOneOf<T extends string>(
  value: string | undefined,
  options: readonly T[],
): value is T {
  return value !== undefined && (options as readonly string[]).includes(value);
}
