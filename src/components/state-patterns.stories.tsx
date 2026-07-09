import type { Meta, StoryObj } from "@storybook/nextjs";
import { Inbox, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Toaster, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Binding state patterns (T006 acceptance criteria). Every list or async view
 * MUST cover these three states:
 *
 *   • Loading — <Skeleton /> mirroring the loaded content's shape.
 *   • Empty   — <EmptyState /> with a next-step action (no dead ends, §53.1).
 *   • Error   — a destructive <Toaster /> toast for transient failures, or an
 *               inline message for field/section-level errors.
 *
 * Feature screens should reuse these components rather than inventing new
 * treatments so the experience stays consistent.
 */
const meta = {
  title: "Foundations/State patterns",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => (
    <Card className="w-full max-w-md">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </CardContent>
    </Card>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      className="max-w-md"
      icon={<Inbox />}
      title="Zatím žádné zprávy"
      description="Až vám někdo napíše, konverzace se objeví tady."
      action={<Button>Prozkoumat architekty</Button>}
    />
  ),
};

export const ErrorToast: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">
        Transientní chyby (např. selhání odeslání) hlaste toastem:
      </p>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Nepodařilo se uložit změny", {
            description: "Zkuste to prosím znovu.",
          })
        }
      >
        Vyvolat chybový toast
      </Button>
      <Toaster />
    </div>
  ),
};

export const ErrorInline: Story = {
  render: () => (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 text-destructive flex max-w-md items-start gap-3 rounded-md border p-4 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Formulář se nepodařilo odeslat</p>
        <p className="text-destructive/80">
          Zkontrolujte zvýrazněná pole a zkuste to znovu.
        </p>
      </div>
    </div>
  ),
};
