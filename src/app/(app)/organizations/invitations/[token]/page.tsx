import Link from "next/link";
import { Mail } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getInvitationView } from "@/features/organizations/queries";
import { ORG_ROLE_LABELS } from "@/features/organizations/types";
import { InvitationResponse } from "@/features/organizations/components/invitation-response";

/**
 * Stránka přijetí pozvánky do firmy (T009). Je pod `(app)`, takže nepřihlášeného
 * middleware pošle na login s návratovou URL — po přihlášení/registraci se sem
 * vrátí (tím se „existující připojí / nový projde registrací a pak se připojí").
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Auth gate: nepřihlášeného pošle middleware na login s návratem sem.
  await requireUser();
  const invitation = await getInvitationView(token);

  if (!invitation) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<Mail />}
          title="Pozvánka nenalezena"
          description="Odkaz je neplatný nebo byl zrušen."
          action={
            <Button asChild variant="outline">
              <Link href="/organizations">Přejít na firmy</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
            <Mail className="size-5" />
          </div>
          <CardTitle>Pozvánka do firmy {invitation.orgName}</CardTitle>
          <CardDescription>
            Role po přijetí: {ORG_ROLE_LABELS[invitation.role]}. Pozvánka byla
            zaslána na {invitation.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!invitation.actionable ? (
            <p className="text-muted-foreground text-sm">
              Tato pozvánka už není platná (vypršela nebo byla vyřízena).
            </p>
          ) : !invitation.emailMatchesViewer ? (
            <p className="text-muted-foreground text-sm">
              Jste přihlášeni jako jiný účet, než na který pozvánka dorazila.
              Přihlaste se prosím účtem <strong>{invitation.email}</strong>{" "}
              (nebo si ho zaregistrujte) a otevřete odkaz znovu.
            </p>
          ) : (
            <InvitationResponse token={invitation.token} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
