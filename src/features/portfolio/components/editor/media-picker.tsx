"use client";

import { useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MIME_TYPES,
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  tooLargeMessage,
  unsupportedTypeMessage,
} from "@/features/media/types";
import type { MediaCardData } from "@/features/media/components/media-library";

/** Vybraný obrázek předaný do bloku: URL derivátu + vazba na asset (usage seam). */
export type PickedImage = { assetId: string; url: string; alt?: string };

/** URL web-derivátu assetu pro vložení do bloku (T014 serve route). */
export function assetWebUrl(assetId: string): string {
  return `/api/media/${assetId}/web`;
}

const ACCEPT = ALLOWED_MIME_TYPES.join(",");

type UploadResponse = {
  assets?: MediaCardData[];
  errors?: { name: string; message: string }[];
  message?: string;
};

/**
 * Výběr obrázků z vlastní knihovny médií (T013 § Validation — jen vlastní média).
 * Podporuje jednotlivý i vícenásobný výběr a nahrání nových souborů rovnou z
 * dialogu (přes `/api/media/upload`, stejně jako knihovna T014).
 */
export function MediaPicker({
  open,
  onOpenChange,
  multiple = false,
  assets,
  onAssetsChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  multiple?: boolean;
  assets: MediaCardData[];
  onAssetsChange: (next: MediaCardData[]) => void;
  onPick: (images: PickedImage[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function toImage(asset: MediaCardData): PickedImage {
    return {
      assetId: asset.id,
      url: assetWebUrl(asset.id),
      alt: asset.altText ?? undefined,
    };
  }

  function pickSingle(asset: MediaCardData) {
    onPick([toImage(asset)]);
    onOpenChange(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmMulti() {
    const picked = assets.filter((a) => selected.has(a.id)).map(toImage);
    if (picked.length === 0) return;
    onPick(picked);
    setSelected(new Set());
    onOpenChange(false);
  }

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files: File[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(tooLargeMessage(file.name));
        continue;
      }
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(unsupportedTypeMessage(file.name));
        continue;
      }
      files.push(file);
    }
    if (files.length === 0) return;

    const form = new FormData();
    for (const file of files.slice(0, MAX_BATCH_FILES)) {
      form.append("files", file);
    }

    setUploading(true);
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const data: UploadResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Upload se nezdařil.");
        return;
      }
      const uploaded = data.assets ?? [];
      if (uploaded.length > 0) {
        onAssetsChange([...uploaded, ...assets]);
        toast.success(
          uploaded.length === 1
            ? "Soubor nahrán."
            : `Nahráno souborů: ${uploaded.length}.`,
        );
      }
      for (const err of data.errors ?? []) toast.error(err.message);
    } catch {
      toast.error("Upload se nezdařil (síťová chyba).");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(new Set());
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vyberte z knihovny</DialogTitle>
          <DialogDescription>
            {multiple
              ? "Označte obrázky, které chcete přidat, nebo nahrajte nové."
              : "Klikněte na obrázek, nebo nahrajte nový."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Nahrávám…" : "Nahrát nový"}
          </Button>
        </div>

        {assets.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title="Knihovna je prázdná"
            description="Nahrajte první obrázek – hned ho vložíte do díla."
          />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {assets.map((asset) => {
              const isSelected = selected.has(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={multiple ? isSelected : undefined}
                  onClick={() =>
                    multiple ? toggle(asset.id) : pickSingle(asset)
                  }
                  className={cn(
                    "group bg-muted relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                    isSelected
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.altText ?? ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {multiple && isSelected && (
                    <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {multiple && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button onClick={confirmMulti} disabled={selected.size === 0}>
              Přidat vybrané ({selected.size})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
