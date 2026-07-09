import type { Meta, StoryObj } from "@storybook/nextjs";

/**
 * Design tokens (T006). Colors are HSL CSS variables mapped to Tailwind theme
 * colors in `globals.css`; use the semantic Tailwind classes shown below rather
 * than hard-coded values so light/dark themes stay in sync.
 */
const meta = {
  title: "Foundations/Design tokens",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const COLORS: { name: string; className: string; text: string }[] = [
  { name: "background", className: "bg-background", text: "text-foreground" },
  { name: "foreground", className: "bg-foreground", text: "text-background" },
  {
    name: "primary",
    className: "bg-primary",
    text: "text-primary-foreground",
  },
  {
    name: "secondary",
    className: "bg-secondary",
    text: "text-secondary-foreground",
  },
  { name: "muted", className: "bg-muted", text: "text-muted-foreground" },
  { name: "accent", className: "bg-accent", text: "text-accent-foreground" },
  {
    name: "destructive",
    className: "bg-destructive",
    text: "text-destructive-foreground",
  },
  {
    name: "success",
    className: "bg-success",
    text: "text-success-foreground",
  },
  {
    name: "warning",
    className: "bg-warning",
    text: "text-warning-foreground",
  },
];

const TYPE_SCALE: { label: string; className: string }[] = [
  { label: "text-4xl / bold", className: "text-4xl font-bold" },
  { label: "text-2xl / semibold", className: "text-2xl font-semibold" },
  { label: "text-lg", className: "text-lg" },
  { label: "text-base", className: "text-base" },
  { label: "text-sm", className: "text-sm" },
  { label: "text-xs / muted", className: "text-xs text-muted-foreground" },
];

export const Colors: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
      {COLORS.map((color) => (
        <div
          key={color.name}
          className={`flex h-24 flex-col justify-end rounded-lg border p-3 ${color.className} ${color.text}`}
        >
          <span className="text-sm font-medium">{color.name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="space-y-4 p-6">
      {TYPE_SCALE.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">{item.label}</span>
          <span className={item.className}>Rychlá hnědá liška</span>
        </div>
      ))}
    </div>
  ),
};

export const Radius: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6 p-6">
      {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"].map((r) => (
        <div key={r} className="flex flex-col items-center gap-2">
          <div className={`bg-secondary size-20 border ${r}`} />
          <span className="text-muted-foreground text-xs">{r}</span>
        </div>
      ))}
    </div>
  ),
};
