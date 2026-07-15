import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminDashboardCounts } from "@/features/admin/users/queries";

/** Admin dashboard (T035 § Main flow 6) — jen základní počty z DB, bez analytics. */
export default async function AdminPage() {
  const counts = await getAdminDashboardCounts();

  const tiles = [
    { label: "Uživatelé", value: counts.users },
    { label: "Publikované profily", value: counts.professionalProfiles },
    { label: "Aktivní poptávky", value: counts.activeRequests },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administrace</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Přehled platformy — správu uživatelů a taxonomie najdete v menu.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl">{tile.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
