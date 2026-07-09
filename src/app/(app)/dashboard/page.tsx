import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Přehled</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Placeholder přihlášené části — aplikační layout (T006).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Nové poptávky", "Nepřečtené zprávy", "Zobrazení profilu"].map(
          (title) => (
            <Card key={title}>
              <CardHeader>
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-3xl">—</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Data doplní příslušné feature tasky.
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
