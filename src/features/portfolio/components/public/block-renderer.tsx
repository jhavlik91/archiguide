import Link from "next/link";
import type { PortfolioBlock } from "../../blocks";
import { GalleryLightbox } from "./gallery-lightbox";
import { BeforeAfter } from "./before-after";

/**
 * Render obsahových bloků publikovaného díla (T016). Server komponenta —
 * interaktivní bloky (galerie, before/after) deleguje na klientské komponenty.
 * Bloky přicházejí už zvalidované (`parsePortfolioBlocks`), takže se tu jen
 * vykreslují; neznámé typy sem nedorazí.
 *
 * Tyto komponenty jsou sdílený render (T016) — náhled v editoru (T013) je použije,
 * aby veřejná verze a náhled vypadaly stejně (T013 § Acceptance).
 */
export function BlockRenderer({ blocks }: { blocks: PortfolioBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-8">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

/** Rozdělí prostý text na odstavce podle prázdných řádků. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function Block({ block }: { block: PortfolioBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.content.level === 3 ? "h3" : "h2";
      return (
        <Tag className="text-foreground text-2xl font-semibold tracking-tight">
          {block.content.text}
        </Tag>
      );
    }

    case "text":
      return (
        <div className="text-foreground/90 space-y-4 leading-relaxed">
          {paragraphs(block.content.text).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );

    case "quote":
      return (
        <blockquote className="border-primary/40 text-foreground/90 border-l-4 pl-4 text-lg italic">
          <p>{block.content.text}</p>
          {block.content.author && (
            <footer className="text-muted-foreground mt-2 text-sm not-italic">
              — {block.content.author}
            </footer>
          )}
        </blockquote>
      );

    case "list":
      return block.content.style === "numbered" ? (
        <ol className="text-foreground/90 list-decimal space-y-1 pl-6">
          {block.content.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="text-foreground/90 list-disc space-y-1 pl-6">
          {block.content.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {block.content.headers && block.content.headers.length > 0 && (
              <thead>
                <tr className="border-border border-b text-left">
                  {block.content.headers.map((header, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.content.rows.map((row, ri) => (
                <tr key={ri} className="border-border/60 border-b">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "technical_data":
      return (
        <dl className="border-border grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 sm:grid-cols-2">
          {block.content.items.map((item, i) => (
            <div key={i} className="flex flex-col">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                {item.label}
              </dt>
              <dd className="text-foreground font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      );

    case "cta":
      return (
        <div className="bg-muted/50 border-border flex flex-col gap-3 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between">
          {block.content.description && (
            <p className="text-foreground/90">{block.content.description}</p>
          )}
          <Link
            href={block.content.url}
            className="bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {block.content.label}
          </Link>
        </div>
      );

    case "image":
      return (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.content.url}
            alt={block.content.alt ?? ""}
            loading="lazy"
            className="w-full rounded-lg bg-muted object-cover"
          />
          {block.content.caption && (
            <figcaption className="text-muted-foreground text-sm">
              {block.content.caption}
            </figcaption>
          )}
        </figure>
      );

    case "gallery":
      return <GalleryLightbox images={block.content.images} />;

    case "before_after":
      return (
        <BeforeAfter
          before={block.content.before}
          after={block.content.after}
          beforeLabel={block.content.beforeLabel}
          afterLabel={block.content.afterLabel}
        />
      );
  }
}
