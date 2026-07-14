import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listRequestsForUser } from "@/features/requests/service";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type RequestStatus,
} from "@/features/requests/types";

/**
 * Dashboard vlastníka — moje poptávky (T024, main flow §7). Seznam se stavem a
 * počtem reakcí (slot pro T027). Poptávka vzniká z briefu, takže prázdný stav
 * vede na guide/brief (žádná slepá ulička). Prošlé poptávky se cestou expirují.
 */

/** Barevná varianta badge dle stavu (aktivní zvýrazněná, terminální ztlumené). */
function statusVariant(
  status: RequestStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active" || status === "in_discussion") return "default";
  if (status === "cancelled" || status === "expired") return "destructive";
  if (status === "awarded" || status === "closed") return "secondary";
  return "outline";
}

export default async function RequestsPage() {
  const actor = await requireUser();
  const requests = await listRequestsForUser(actor.userId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Moje poptávky
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Poptávky vytvořené z vašich briefů a jejich stav.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Zatím žádné poptávky"
          description="Poptávku vytvoříte z projektového briefu. Nemáte-li brief, začněte průvodcem."
          action={
            <Button asChild>
              <Link href="/guide">Spustit průvodce</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link href={`/requests/${request.id}`} className="block">
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{request.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {REQUEST_TYPE_LABELS[request.type]} · {request.region}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">
                        {request.responseCount} reakcí
                      </span>
                      <Badge variant={statusVariant(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
