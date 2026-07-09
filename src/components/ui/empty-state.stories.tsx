import type { Meta, StoryObj } from "@storybook/nextjs";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  args: { title: "Zatím žádné poptávky" },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <EmptyState
      className="w-96"
      icon={<Inbox />}
      title="Zatím žádné poptávky"
      description="Jakmile klienti pošlou poptávku odpovídající vašemu profilu, objeví se tady."
      action={<Button>Upravit profil</Button>}
    />
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <EmptyState
      className="w-96"
      icon={<Inbox />}
      title="Žádné výsledky"
      description="Zkuste upravit filtry vyhledávání."
    />
  ),
};
