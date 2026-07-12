"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaCardData } from "@/features/media/components/media-library";
import { MediaPicker, type PickedImage } from "./media-picker";
import type { EditorBlock } from "./types";

/**
 * Editory obsahu jednotlivých typů bloků (T013). Textová pole jsou NEřízená
 * (`defaultValue`) — obsah se propisuje do stavu na `onChange`, ale hodnotu pole
 * zpět nepřepisujeme, takže psaní neruší kurzor a řádkové seznamy jde pohodlně
 * upravovat. Undo/redo cílí na strukturu (přidání/smazání/přeřazení, T013 § AC).
 */

type ContentChange = (content: Record<string, unknown>) => void;

type InputsProps = {
  block: EditorBlock;
  assets: MediaCardData[];
  onAssetsChange: (next: MediaCardData[]) => void;
  onChange: ContentChange;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Rozdělí text na řádky, ořízne okraje a zahodí prázdné. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Jeden obrázkový slot: náhled + výběr z knihovny / odebrání. */
function ImageSlot({
  label,
  image,
  assets,
  onAssetsChange,
  onPick,
  onClear,
}: {
  label: string;
  image: { url?: unknown; alt?: unknown } | null;
  assets: MediaCardData[];
  onAssetsChange: (next: MediaCardData[]) => void;
  onPick: (picked: PickedImage) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const url = str(image?.url);

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {url ? (
        <div className="group border-border relative overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={str(image?.alt)}
            className="max-h-48 w-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              Změnit
            </Button>
            <Button size="sm" variant="destructive" onClick={onClear}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <ImagePlus className="size-4" /> Vybrat obrázek
        </Button>
      )}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        assets={assets}
        onAssetsChange={onAssetsChange}
        onPick={(picked) => picked[0] && onPick(picked[0])}
      />
    </div>
  );
}

export function BlockContentEditor({
  block,
  assets,
  onAssetsChange,
  onChange,
}: InputsProps) {
  const c = block.content;
  const [galleryOpen, setGalleryOpen] = useState(false);

  switch (block.type) {
    case "heading":
      return (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="flex-1"
            defaultValue={str(c.text)}
            placeholder="Text nadpisu"
            onChange={(e) => onChange({ ...c, text: e.target.value })}
          />
          <Select
            value={String(c.level ?? 2)}
            onValueChange={(v) => onChange({ ...c, level: Number(v) })}
          >
            <SelectTrigger className="sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Úroveň 2</SelectItem>
              <SelectItem value="3">Úroveň 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "text":
      return (
        <Textarea
          rows={5}
          defaultValue={str(c.text)}
          placeholder="Odstavce oddělte prázdným řádkem."
          onChange={(e) => onChange({ ...c, text: e.target.value })}
        />
      );

    case "quote":
      return (
        <div className="space-y-3">
          <Textarea
            rows={3}
            defaultValue={str(c.text)}
            placeholder="Text citace"
            onChange={(e) => onChange({ ...c, text: e.target.value })}
          />
          <Input
            defaultValue={str(c.author)}
            placeholder="Autor (volitelné)"
            onChange={(e) => onChange({ ...c, author: e.target.value })}
          />
        </div>
      );

    case "list":
      return (
        <div className="space-y-3">
          <Select
            value={str(c.style) || "bulleted"}
            onValueChange={(v) => onChange({ ...c, style: v })}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bulleted">Odrážky</SelectItem>
              <SelectItem value="numbered">Číslovaný</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            rows={5}
            defaultValue={(Array.isArray(c.items) ? c.items : []).join("\n")}
            placeholder="Jedna položka na řádek"
            onChange={(e) => onChange({ ...c, items: lines(e.target.value) })}
          />
        </div>
      );

    case "table":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              Záhlaví (volitelné) — sloupce oddělte znakem |
            </Label>
            <Input
              defaultValue={(Array.isArray(c.headers) ? c.headers : []).join(
                " | ",
              )}
              placeholder="Parametr | Hodnota"
              onChange={(e) =>
                onChange({
                  ...c,
                  headers: e.target.value
                    .split("|")
                    .map((h) => h.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              Řádky — jeden na řádek, buňky oddělte |
            </Label>
            <Textarea
              rows={5}
              defaultValue={(Array.isArray(c.rows) ? (c.rows as string[][]) : [])
                .map((row) => row.join(" | "))
                .join("\n")}
              placeholder={"Podlahová plocha | 120 m²\nDispozice | 4+kk"}
              onChange={(e) =>
                onChange({
                  ...c,
                  rows: lines(e.target.value).map((row) =>
                    row.split("|").map((cell) => cell.trim()),
                  ),
                })
              }
            />
          </div>
        </div>
      );

    case "technical_data":
      return (
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">
            Dvojice parametr | hodnota — jedna na řádek
          </Label>
          <Textarea
            rows={5}
            defaultValue={(
              Array.isArray(c.items)
                ? (c.items as { label?: string; value?: string }[])
                : []
            )
              .map((it) => `${it.label ?? ""} | ${it.value ?? ""}`)
              .join("\n")}
            placeholder={"Zastavěná plocha | 210 m²\nMateriál | pohledový beton"}
            onChange={(e) =>
              onChange({
                ...c,
                items: lines(e.target.value).map((line) => {
                  const [label, ...rest] = line.split("|");
                  return {
                    label: (label ?? "").trim(),
                    value: rest.join("|").trim(),
                  };
                }),
              })
            }
          />
        </div>
      );

    case "cta":
      return (
        <div className="space-y-3">
          <Input
            defaultValue={str(c.label)}
            placeholder="Text tlačítka (např. Kontaktujte nás)"
            onChange={(e) => onChange({ ...c, label: e.target.value })}
          />
          <Input
            defaultValue={str(c.url)}
            placeholder="https://…"
            onChange={(e) => onChange({ ...c, url: e.target.value })}
          />
          <Input
            defaultValue={str(c.description)}
            placeholder="Doplňující text (volitelné)"
            onChange={(e) => onChange({ ...c, description: e.target.value })}
          />
        </div>
      );

    case "image":
      return (
        <div className="space-y-3">
          <ImageSlot
            label="Obrázek"
            image={c as { url?: unknown; alt?: unknown }}
            assets={assets}
            onAssetsChange={onAssetsChange}
            onPick={(picked) =>
              onChange({
                ...c,
                url: picked.url,
                assetId: picked.assetId,
                alt: picked.alt ?? "",
              })
            }
            onClear={() =>
              onChange({ ...c, url: "", assetId: undefined, alt: "" })
            }
          />
          <Input
            defaultValue={str(c.caption)}
            placeholder="Popisek (volitelné)"
            onChange={(e) => onChange({ ...c, caption: e.target.value })}
          />
        </div>
      );

    case "gallery": {
      const images = Array.isArray(c.images)
        ? (c.images as PickedImage[])
        : [];
      return (
        <div className="space-y-3">
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img, i) => (
                <div
                  key={`${img.assetId ?? img.url}-${i}`}
                  className="group border-border relative aspect-square overflow-hidden rounded-md border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-full w-full object-cover"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 size-7 opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      onChange({
                        ...c,
                        images: images.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={() => setGalleryOpen(true)}>
            <ImagePlus className="size-4" /> Přidat obrázky
          </Button>
          <MediaPicker
            open={galleryOpen}
            onOpenChange={setGalleryOpen}
            multiple
            assets={assets}
            onAssetsChange={onAssetsChange}
            onPick={(picked) => onChange({ ...c, images: [...images, ...picked] })}
          />
        </div>
      );
    }

    case "before_after": {
      const before = (c.before ?? {}) as { url?: unknown; alt?: unknown };
      const after = (c.after ?? {}) as { url?: unknown; alt?: unknown };
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageSlot
              label="Před"
              image={before}
              assets={assets}
              onAssetsChange={onAssetsChange}
              onPick={(p) =>
                onChange({
                  ...c,
                  before: { url: p.url, assetId: p.assetId, alt: p.alt ?? "" },
                })
              }
              onClear={() => onChange({ ...c, before: { url: "" } })}
            />
            <ImageSlot
              label="Po"
              image={after}
              assets={assets}
              onAssetsChange={onAssetsChange}
              onPick={(p) =>
                onChange({
                  ...c,
                  after: { url: p.url, assetId: p.assetId, alt: p.alt ?? "" },
                })
              }
              onClear={() => onChange({ ...c, after: { url: "" } })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              defaultValue={str(c.beforeLabel)}
              placeholder="Popisek „před“ (volitelné)"
              onChange={(e) => onChange({ ...c, beforeLabel: e.target.value })}
            />
            <Input
              defaultValue={str(c.afterLabel)}
              placeholder="Popisek „po“ (volitelné)"
              onChange={(e) => onChange({ ...c, afterLabel: e.target.value })}
            />
          </div>
        </div>
      );
    }
  }
}
