import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Vyberte profesi" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Architektura</SelectLabel>
          <SelectItem value="architect">Architekt</SelectItem>
          <SelectItem value="interior">Interiérový designér</SelectItem>
          <SelectItem value="landscape">Krajinný architekt</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Inženýring</SelectLabel>
          <SelectItem value="structural">Statik</SelectItem>
          <SelectItem value="mep">TZB inženýr</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
