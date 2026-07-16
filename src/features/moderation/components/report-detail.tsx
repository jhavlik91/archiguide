"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  moderateReportAction,
  restoreTargetVisibilityAction,
} from "../actions";
import {
  MODERATION_ACTION_LABELS,
  MODERATION_ACTION_TYPES,
  OPEN_REPORT_STATES,
  REPORT_REASON_LABELS,
  REPORT_STATE_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  type ModerationActionType,
  type ReportDetailView,
  type ReportListItem,
} from "../types";
import { formatDateTime } from "./format";

/**
 * Detail případu v admin frontě (T036 § Main flow bod 4–5). Náhled obsahu
 * s nezbytným kontextem, historie případu, formulář moderační akce (vždy
 * s povinným důvodem) a obnovení viditelnosti dříve skrytého cíle.
 */
export function ReportDetail({
  view,
  labels,
  canSuspend,
}: {
  view: ReportDetailView;
  labels: Record<string, string>;
  canSuspend: boolean;
}) {
  const label = (userId: string) => labels[userId] ?? userId;
  const isUnresolved = (OPEN_REPORT_STATES as readonly string[]).includes(
    view.state,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {REPORT_TARGET_TYPE_LABELS[view.targetType]}
            </Badge>
            <h1 className="text-xl font-semibold">
              {REPORT_REASON_LABELS[view.reason]}
            </h1>
          </div>
          <p className="text-muted-foreground text-xs">
            Založeno {formatDateTime(view.createdAt)}
          </p>
        </div>
        <Badge variant={view.state === "open" ? "warning" : "outline"}>
          {REPORT_STATE_LABELS[view.state]}
        </Badge>
      </div>

      <TargetPreviewCard view={view} label={label} />

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">
            Nahlášení ({view.submissions.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {view.submissions.map((s) => (
              <li key={s.id} className="border-b pb-2 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{label(s.reporterUserId)}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(s.createdAt)}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {REPORT_REASON_LABELS[s.reason]}
                  {s.note ? ` — ${s.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {view.actions.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Historie zásahů</h2>
            <ul className="space-y-2 text-sm">
              {view.actions.map((a) => (
                <li
                  key={a.id}
                  className="border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {MODERATION_ACTION_LABELS[a.actionType]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(a.createdAt)} ·{" "}
                      {a.moderatorUserId ? label(a.moderatorUserId) : "systém"}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{a.reason}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {view.targetModerationState === "hidden" ? (
        <RestoreCard view={view} />
      ) : null}

      <HistoryList
        title="Další nahlášení tohoto cíle"
        items={view.targetHistory}
      />
      <HistoryList
        title="Další případy prvního nahlašovatele"
        items={view.firstReporterHistory}
      />

      {isUnresolved ? (
        <ActionForm reportId={view.id} canSuspend={canSuspend} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Případ je vyřešen — další akci nelze přidat bez odvolání.
        </p>
      )}
    </div>
  );
}

function TargetPreviewCard({
  view,
  label,
}: {
  view: ReportDetailView;
  label: (userId: string) => string;
}) {
  const preview = view.preview;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Nahlášený obsah</h2>
        {preview.kind === "unavailable" ? (
          <p className="text-muted-foreground text-sm">Obsah není dostupný.</p>
        ) : null}
        {preview.kind === "message" ? (
          <div className="space-y-2 text-sm">
            {preview.context
              .filter((m) => m.createdAt < preview.createdAt)
              .map((m) => (
                <MessagePreviewRow key={m.id} m={m} label={label} muted />
              ))}
            <MessagePreviewRow
              m={{
                id: preview.messageId,
                senderUserId: preview.senderUserId,
                content: preview.content,
                createdAt: preview.createdAt,
              }}
              label={label}
              highlighted
            />
            {preview.context
              .filter((m) => m.createdAt > preview.createdAt)
              .map((m) => (
                <MessagePreviewRow key={m.id} m={m} label={label} muted />
              ))}
            <p className="text-muted-foreground text-xs">
              Zobrazeno je jen bezprostřední okolí nahlášené zprávy, ne celá
              konverzace.
            </p>
          </div>
        ) : null}
        {(preview.kind === "profile" ||
          preview.kind === "portfolio_project" ||
          preview.kind === "request" ||
          preview.kind === "request_response") && (
          <div className="text-sm">
            {preview.href ? (
              <Link href={preview.href} className="font-medium hover:underline">
                {preview.title}
              </Link>
            ) : (
              <span className="font-medium">{preview.title}</span>
            )}
            {preview.ownerUserId ? (
              <p className="text-muted-foreground">
                Vlastník: {label(preview.ownerUserId)}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessagePreviewRow({
  m,
  label,
  highlighted,
  muted,
}: {
  m: { id: string; senderUserId: string; content: string; createdAt: string };
  label: (userId: string) => string;
  highlighted?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? "border-warning bg-warning/10 rounded-md border px-3 py-2"
          : muted
            ? "text-muted-foreground px-3 py-1 opacity-70"
            : "px-3 py-1"
      }
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label(m.senderUserId)}</span>
        <span>{formatDateTime(m.createdAt)}</span>
      </div>
      <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
    </div>
  );
}

function HistoryList({
  title,
  items,
}: {
  title: string;
  items: ReportListItem[];
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <ul className="space-y-1 text-sm">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/reports/${r.id}`} className="hover:underline">
                {REPORT_REASON_LABELS[r.reason]} —{" "}
                {REPORT_STATE_LABELS[r.state]}
              </Link>
              <span className="text-muted-foreground">
                {" "}
                ({formatDateTime(r.createdAt)})
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RestoreCard({ view }: { view: ReportDetailView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const result = await restoreTargetVisibilityAction(
        view.targetType,
        view.targetId,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Obsah byl obnoven.");
      router.refresh();
    });
  }

  return (
    <Card className="border-warning/40">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2 text-sm">
          <ShieldAlert className="text-warning size-4" />
          <span>Cíl je aktuálně skrytý.</span>
        </div>
        <Button variant="outline" onClick={restore} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Obnovit viditelnost
        </Button>
      </CardContent>
    </Card>
  );
}

function ActionForm({
  reportId,
  canSuspend,
}: {
  reportId: string;
  canSuspend: boolean;
}) {
  const router = useRouter();
  const [actionType, setActionType] =
    useState<ModerationActionType>("no_action");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const availableActions = MODERATION_ACTION_TYPES.filter(
    (a) =>
      canSuspend || (a !== "suspend_temporary" && a !== "suspend_permanent"),
  );

  function submit() {
    startTransition(async () => {
      const result = await moderateReportAction(reportId, {
        actionType,
        reason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Moderační akce byla provedena.");
      setReason("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Moderační akce</h2>
        <div className="space-y-1.5">
          <Label htmlFor="action-type">Typ akce</Label>
          <Select
            value={actionType}
            onValueChange={(v) => setActionType(v as ModerationActionType)}
          >
            <SelectTrigger id="action-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {MODERATION_ACTION_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="action-reason">
            Důvod (povinný, uvidí auditní záznam)
          </Label>
          <Textarea
            id="action-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Např. „Zpráva obsahuje osobní útok mimo věcnou rovinu.“"
          />
        </div>
        <Button onClick={submit} disabled={pending || reason.trim().length < 5}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Provést akci
        </Button>
      </CardContent>
    </Card>
  );
}
