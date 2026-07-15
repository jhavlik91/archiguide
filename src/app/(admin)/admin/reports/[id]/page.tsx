import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import {
  P_REPORT_QUEUE,
  canSuspendAccount,
} from "@/features/moderation/permissions";
import {
  getReportDetail,
  resolveUserEmails,
} from "@/features/moderation/service";
import { ReportDetail } from "@/features/moderation/components/report-detail";

/** Detail případu (T036 § Main flow bod 4): náhled, historie, moderační akce. */
export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission(P_REPORT_QUEUE);
  const { id } = await params;

  const result = await getReportDetail(id);
  if (!result.ok) notFound();
  const view = result.view;

  const userIds = [
    ...view.submissions.map((s) => s.reporterUserId),
    ...view.actions
      .map((a) => a.moderatorUserId)
      .filter((id): id is string => id !== null),
    ...(view.preview.kind === "message" ? [view.preview.senderUserId] : []),
    ...(view.preview.kind === "message"
      ? view.preview.context.map((m) => m.senderUserId)
      : []),
    ...(view.preview.kind === "profile" ||
    view.preview.kind === "portfolio_project"
      ? view.preview.ownerUserId
        ? [view.preview.ownerUserId]
        : []
      : []),
    ...(view.preview.kind === "request" ? [view.preview.ownerUserId] : []),
  ];
  const emails = await resolveUserEmails(userIds);

  return (
    <ReportDetail
      view={view}
      labels={Object.fromEntries(emails)}
      canSuspend={canSuspendAccount(actor)}
    />
  );
}
