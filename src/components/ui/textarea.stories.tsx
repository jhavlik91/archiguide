import type { Meta, StoryObj } from "@storybook/nextjs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  args: { placeholder: "Popište svůj záměr…" },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Textarea className="w-80" {...args} />,
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-80 gap-1.5">
      <Label htmlFor="brief">Zadání</Label>
      <Textarea id="brief" {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => <Textarea className="w-80" disabled {...args} />,
};
