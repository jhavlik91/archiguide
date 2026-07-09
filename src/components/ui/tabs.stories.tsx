import type { Meta, StoryObj } from "@storybook/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="portfolio" className="w-80">
      <TabsList>
        <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        <TabsTrigger value="reviews">Hodnocení</TabsTrigger>
        <TabsTrigger value="about">O mně</TabsTrigger>
      </TabsList>
      <TabsContent value="portfolio" className="text-muted-foreground text-sm">
        Ukázky realizovaných projektů.
      </TabsContent>
      <TabsContent value="reviews" className="text-muted-foreground text-sm">
        Hodnocení od klientů.
      </TabsContent>
      <TabsContent value="about" className="text-muted-foreground text-sm">
        Profesní životopis a specializace.
      </TabsContent>
    </Tabs>
  ),
};
