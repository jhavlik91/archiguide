"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { withdrawResponseAction } from "../actions";
import { authorActions } from "../state-machine";
import {
  RESPONSE_STATUS_LABELS,
  type ResponseListItemForAuthor,
  type ResponseStatus,
} from "../types";

/** Dashboard „moje reakce" profesionála (T027 § Main flow bod 7). */
export function MyResponsesList({
  responses,
}: {
  responses: ResponseListItemForAuthor[];
}) {
  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm sm:p-6">
          Zatím jste na žádnou poptávku nereagovali. Reakci pošlete z detailu
          veřejné poptávky.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {responses.map((response) => (
        <MyResponseCard key={response.id} response={response} />
      ))}
    </div>
  );
}

function statusVariant(
  status: ResponseStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "shortlisted") return "default";
  if (status === "accepted") return "secondary";
  if (status === "rejected" || status === "withdrawn") return "destructive";
  return "outline";
}

function MyResponseCard({ response }: { response: ResponseListItemForAuthor }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canWithdraw = authorActions(response.status).includes("withdraw");

  function withdraw() {
    startTransition(async () => {
      const res = await withdrawResponseAction(response.id);
      if (res.ok) {
        toast.success("Reakce stažena.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/poptavka/${response.requestId}`}
            className="font-medium hover:underline"
          >
            {response.requestTitle}
          </Link>
          <Badge variant={statusVariant(response.status)}>
            {RESPONSE_STATUS_LABELS[response.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {response.message}
        </p>
        {response.status === "rejected" && response.rejectionReason ? (
          <p className="text-muted-foreground text-sm">
            Důvod odmítnutí: {response.rejectionReason}
          </p>
        ) : null}
        {canWithdraw ? (
          <Button variant="ghost" size="sm" onClick={withdraw} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Stáhnout reakci
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
