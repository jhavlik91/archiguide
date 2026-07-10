import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyOrganizations } from "@/features/organizations/queries";
import { ORG_ROLE_LABELS } from "@/features/organizations/types";
import { CreateOrganization } from "@/features/organizations/components/create-organization";

/**
 * Přehled firem, jichž je uživatel členem, + založení nové. Interní správa;
 * veřejná stránka firmy přijde v T010.
 */
export default async function OrganizationsPage() {
  await requireUser();
  const organizations = await listMyOrganizations();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Firmy</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Firmy, které spravujete nebo jste jejich členem.
        </p>
      </div>

      {organizations.length > 0 && (
        <div className="space-y-3">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/organizations/${org.id}`}
              className="block"
            >
              <Card className="hover:border-primary transition-colors">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{org.name}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Users className="size-3" /> {org.memberCount} členů
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {org.status === "archived" && (
                      <Badge variant="outline">Archivováno</Badge>
                    )}
                    <Badge variant="secondary">
                      {ORG_ROLE_LABELS[org.role]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div>
        {organizations.length === 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">
                Zatím nespravujete žádnou firmu
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Založte firemní profil a pozvěte tým, nebo počkejte na pozvánku od
              kolegy.
            </CardContent>
          </Card>
        )}
        <CreateOrganization />
      </div>
    </div>
  );
}
