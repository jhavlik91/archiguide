import type { Meta, StoryObj } from "@storybook/nextjs";
import { AttachmentItem } from "./attachment-item";
import type { AttachmentView } from "../types";

/**
 * Prezentace přílohy v konzumujícím kontextu (T023). Aktivní příloha je odkaz ke
 * stažení; smazaná se zobrazí jako placeholder místo rozbitého odkazu.
 */
const meta = {
  title: "Attachments/AttachmentItem",
  component: AttachmentItem,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AttachmentItem>;

export default meta;

type Story = StoryObj<typeof meta>;

const base: AttachmentView = {
  id: "att_1",
  fileName: "půdorys-1np.pdf",
  mimeType: "application/pdf",
  byteSize: 842_000,
  visibility: "shared_in_context",
  sensitive: false,
  deleted: false,
  downloadUrl: "/api/attachments/att_1",
};

export const Default: Story = { args: { attachment: base } };

export const Sensitive: Story = {
  args: {
    attachment: {
      ...base,
      fileName: "smlouva-osobni-udaje.pdf",
      sensitive: true,
    },
  },
};

export const WithVisibility: Story = {
  args: { attachment: base, showVisibility: true },
};

export const Deleted: Story = {
  args: { attachment: { ...base, deleted: true, downloadUrl: null } },
};
