import { z } from "zod";

/**
 * Schéma obsahových bloků portfolia — sdílený kontrakt mezi blokovým editorem
 * (T013, zatím nezmergeován) a veřejným renderem (T016). Čistá vrstva (bez DB a
 * `next/*`), aby ji šlo použít v náhledu editoru i na veřejné stránce a pokrýt
 * unit testy.
 *
 * Publikace (T012) zmrazí bloky do snapshotu; veřejná verze z něj čte přes
 * `parsePortfolioBlocks`, který nevalidní/neznámé bloky bezpečně zahodí — starý
 * snapshot ani budoucí typ z novější verze editoru nikdy nesmí render shodit.
 *
 * MVP sada typů (T013 § Inputs): heading, text, quote, list, table,
 * technical_data, cta, image, gallery, before_after. Pokročilé bloky (video,
 * map, pdf, floorplan, timeline, budget, award, materials, team) jsou post-MVP.
 */

/** Odkaz na obrázek. `url` dodává media knihovna (T014); zde jen URL. */
const imageRefSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});
export type PortfolioImageRef = z.infer<typeof imageRefSchema>;

const headingBlockSchema = z.object({
  type: z.literal("heading"),
  content: z.object({
    text: z.string().min(1),
    /** Úroveň v rámci stránky (h2/h3). Hero drží h1, takže nejvýš h2. */
    level: z.union([z.literal(2), z.literal(3)]).default(2),
  }),
});

const textBlockSchema = z.object({
  type: z.literal("text"),
  content: z.object({
    /** Prostý text; odstavce se dělí prázdným řádkem. Rich text řeší T013. */
    text: z.string().min(1),
  }),
});

const quoteBlockSchema = z.object({
  type: z.literal("quote"),
  content: z.object({
    text: z.string().min(1),
    author: z.string().optional(),
  }),
});

const listBlockSchema = z.object({
  type: z.literal("list"),
  content: z.object({
    style: z.enum(["bulleted", "numbered"]).default("bulleted"),
    items: z.array(z.string().min(1)).min(1),
  }),
});

const tableBlockSchema = z.object({
  type: z.literal("table"),
  content: z.object({
    headers: z.array(z.string()).optional(),
    rows: z.array(z.array(z.string())).min(1),
  }),
});

const technicalDataBlockSchema = z.object({
  type: z.literal("technical_data"),
  content: z.object({
    items: z
      .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
      .min(1),
  }),
});

const ctaBlockSchema = z.object({
  type: z.literal("cta"),
  content: z.object({
    label: z.string().min(1),
    /** Jen http(s) — URL jde do `<Link href>` na veřejné stránce, `javascript:`
     * a jiná schémata nesmí projít. */
    url: z
      .string()
      .url()
      .refine((url) => /^https?:\/\//i.test(url)),
    description: z.string().optional(),
  }),
});

const imageBlockSchema = z.object({
  type: z.literal("image"),
  content: imageRefSchema,
});

const galleryBlockSchema = z.object({
  type: z.literal("gallery"),
  content: z.object({
    images: z.array(imageRefSchema).min(1),
  }),
});

const beforeAfterBlockSchema = z.object({
  type: z.literal("before_after"),
  content: z.object({
    before: imageRefSchema,
    after: imageRefSchema,
    beforeLabel: z.string().optional(),
    afterLabel: z.string().optional(),
  }),
});

/** Diskriminovaná unie všech renderovatelných bloků (podle `type`). */
export const portfolioBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  quoteBlockSchema,
  listBlockSchema,
  tableBlockSchema,
  technicalDataBlockSchema,
  ctaBlockSchema,
  imageBlockSchema,
  galleryBlockSchema,
  beforeAfterBlockSchema,
]);

export type PortfolioBlock = z.infer<typeof portfolioBlockSchema>;
export type PortfolioBlockType = PortfolioBlock["type"];

/**
 * Bezpečně přečte bloky ze snapshotu (`publishedSnapshot.contentBlocks`, typ
 * `unknown`). Nevalidní i neznámé bloky se tiše zahodí — veřejný render nikdy
 * nesmí spadnout kvůli poškozenému nebo novějšímu snapshotu.
 */
export function parsePortfolioBlocks(raw: unknown): PortfolioBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: PortfolioBlock[] = [];
  for (const candidate of raw) {
    const parsed = portfolioBlockSchema.safeParse(candidate);
    if (parsed.success) blocks.push(parsed.data);
  }
  return blocks;
}

/**
 * URL prvního obrázku napříč bloky (image → gallery → before_after). Používá se
 * jako OG obrázek stránky (T016 § Main flow). `null`, když dílo obrázek nemá.
 */
export function firstImageUrl(blocks: PortfolioBlock[]): string | null {
  for (const block of blocks) {
    if (block.type === "image") return block.content.url;
    if (block.type === "gallery") return block.content.images[0]?.url ?? null;
    if (block.type === "before_after") return block.content.before.url;
  }
  return null;
}
