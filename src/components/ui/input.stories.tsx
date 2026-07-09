import type { Meta, StoryObj } from "@storybook/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "jmeno@example.com" },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="email">E-mail</Label>
      <Input id="email" type="email" {...args} />
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <div className="grid w-72 gap-1.5">
      <Label htmlFor="email-invalid">E-mail</Label>
      <Input id="email-invalid" type="email" aria-invalid {...args} />
      <p className="text-destructive text-sm">Zadejte platný e-mail.</p>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
