import type { Meta, StoryObj } from "@storybook/nextjs";
import { Toaster, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

/**
 * Toasts are the app-wide feedback pattern for success and error states. The
 * <Toaster /> host is mounted once in the root layout; these stories mount a
 * local instance so the buttons work in isolation.
 */
const meta = {
  title: "UI/Toast",
  component: Toaster,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast("Uloženo")}>
        Základní
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Poptávka odeslána")}
      >
        Úspěch
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Odeslání selhalo", {
            description: "Zkontrolujte připojení a zkuste to znovu.",
          })
        }
      >
        Chyba
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Zpráva odeslána", {
            action: { label: "Vrátit zpět", onClick: () => {} },
          })
        }
      >
        S akcí
      </Button>
      <Toaster />
    </div>
  ),
};
