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

/**
 * Odkaz na obrázek. `url` dodává media knihovna (T014, `/api/media/[id]/web`);
 * `assetId` váže blok na konkrétní asset v knihovně (T013 § Validation — obrázkové
 * bloky odkazují jen na vlastní média) a slouží media usage seamu (mazání /
 * veřejné servírování). `assetId` je volitelný kvůli zpětné kompatibilitě starších
 * snapshotů, které URL neměly navázanou na asset.
 */
const imageRefSchema = z.object({
  url: z.string().min(1),
  assetId: z.string().optional(),
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

// ---------------------------------------------------------------------------
// Editor (T013) — paleta typů, výchozí obsah, draftové ukládání
//
// Draft se ukládá LENIENTNĚ: rozpracovaný blok (např. právě přidaný text bez
// obsahu) se musí uložit a přežít reload — žádná tichá ztráta dat (T013 § Alt
// flows). Strict `portfolioBlockSchema` výše se použije až při PUBLIKACI, kde
// `parsePortfolioBlocks` neúplné/nevalidní bloky bezpečně vynechá.
// ---------------------------------------------------------------------------

/** MVP sada typů bloků v pořadí, jak se nabízí v paletě (T013 § Inputs). */
export const PORTFOLIO_BLOCK_TYPES = [
  "heading",
  "text",
  "quote",
  "list",
  "table",
  "technical_data",
  "cta",
  "image",
  "gallery",
  "before_after",
] as const;
export type PortfolioBlockKind = (typeof PORTFOLIO_BLOCK_TYPES)[number];

/** Lidské popisky typů bloků pro paletu a záhlaví bloku (čeština). */
export const PORTFOLIO_BLOCK_LABELS: Record<PortfolioBlockKind, string> = {
  heading: "Nadpis",
  text: "Text",
  quote: "Citace",
  list: "Seznam",
  table: "Tabulka",
  technical_data: "Technické údaje",
  cta: "Výzva k akci",
  image: "Obrázek",
  gallery: "Galerie",
  before_after: "Před / po",
};

/** Krátký popis typu do palety. */
export const PORTFOLIO_BLOCK_HINTS: Record<PortfolioBlockKind, string> = {
  heading: "Mezinadpis sekce",
  text: "Odstavce textu",
  quote: "Zvýrazněná citace",
  list: "Odrážky nebo číslovaný seznam",
  table: "Řádky a sloupce",
  technical_data: "Dvojice parametr–hodnota",
  cta: "Tlačítko s odkazem",
  image: "Jeden obrázek s popiskem",
  gallery: "Více obrázků",
  before_after: "Porovnání dvou obrázků",
};

/** Je řetězec jedním z podporovaných typů bloku? */
export function isPortfolioBlockKind(value: unknown): value is PortfolioBlockKind {
  return (
    typeof value === "string" &&
    (PORTFOLIO_BLOCK_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Výchozí (prázdný, ale správně tvarovaný) obsah pro nově přidaný blok. Je záměrně
 * NEúplný — dokud ho editor nevyplní, publikace ho vynechá; draft se přesto uloží.
 */
export function defaultBlockContent(kind: PortfolioBlockKind): unknown {
  switch (kind) {
    case "heading":
      return { text: "", level: 2 };
    case "text":
      return { text: "" };
    case "quote":
      return { text: "", author: "" };
    case "list":
      return { style: "bulleted", items: [] };
    case "table":
      return { headers: [], rows: [] };
    case "technical_data":
      return { items: [] };
    case "cta":
      return { label: "", url: "", description: "" };
    case "image":
      return { url: "", alt: "", caption: "" };
    case "gallery":
      return { images: [] };
    case "before_after":
      return {
        before: { url: "" },
        after: { url: "" },
        beforeLabel: "",
        afterLabel: "",
      };
  }
}

/** Draftový blok, jak ho drží editor a jak se posílá k uložení (obsah je volný). */
export type DraftPortfolioBlock = {
  type: PortfolioBlockKind;
  content: unknown;
};

/**
 * Schéma jednoho draftového bloku pro ukládání: hlídá jen platný TYP a že obsah je
 * objekt (ne pole/skalár). Obsah se dál nevaliduje — draft smí být rozpracovaný.
 */
export const draftPortfolioBlockSchema = z.object({
  type: z.enum(PORTFOLIO_BLOCK_TYPES),
  content: z.record(z.string(), z.unknown()),
});

/** Horní strop počtu bloků v jednom díle (ochrana proti zneužití). */
export const MAX_PORTFOLIO_BLOCKS = 200;

/** Payload autosave: celý dokument bloků + verze, proti které editor pracuje. */
export const savePortfolioBlocksSchema = z.object({
  projectId: z.string().min(1),
  /** Verze bloků, kterou editor načetl; server podle ní pozná souběžnou editaci. */
  baseVersion: z.number().int().nonnegative(),
  blocks: z.array(draftPortfolioBlockSchema).max(MAX_PORTFOLIO_BLOCKS),
});
export type SavePortfolioBlocksInput = z.infer<typeof savePortfolioBlocksSchema>;

/** Projde blok strict schématem — publikovatelný blok (jinak se při publikaci vynechá). */
export function isBlockPublishable(block: DraftPortfolioBlock): boolean {
  return portfolioBlockSchema.safeParse(block).success;
}

/**
 * ID media assetů, na které blok odkazuje (image → gallery → before_after).
 * Používá media usage seam (T014): zabránit smazání assetu použitého v publikovaném
 * díle a povolit veřejné servírování jeho derivátu. Čte i z rozpracovaného obsahu,
 * proto pracuje defenzivně nad `unknown`.
 */
export function blockAssetIds(block: {
  type: string;
  content: unknown;
}): string[] {
  const content = block.content;
  if (!content || typeof content !== "object") return [];
  const refIds = (ref: unknown): string[] => {
    if (ref && typeof ref === "object" && "assetId" in ref) {
      const id = (ref as { assetId?: unknown }).assetId;
      return typeof id === "string" && id.length > 0 ? [id] : [];
    }
    return [];
  };

  const c = content as Record<string, unknown>;
  switch (block.type) {
    case "image":
      return refIds(c);
    case "gallery":
      return Array.isArray(c.images) ? c.images.flatMap(refIds) : [];
    case "before_after":
      return [...refIds(c.before), ...refIds(c.after)];
    default:
      return [];
  }
}
