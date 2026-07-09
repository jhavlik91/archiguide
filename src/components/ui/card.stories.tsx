import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Rodinný dům, Brno</CardTitle>
          <Badge variant="success">Nová</Badge>
        </div>
        <CardDescription>Novostavba · rozpočet 8–10 mil. Kč</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Hledám architekta pro návrh nízkoenergetického rodinného domu na
        svažitém pozemku.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Detail
        </Button>
        <Button size="sm">Reagovat</Button>
      </CardFooter>
    </Card>
  ),
};
