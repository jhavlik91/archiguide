"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ImageIcon, Loader2, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ALLOWED_MIME_TYPES,
  ALT_TEXT_MAX_LENGTH,
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  tooLargeMessage,
  unsupportedTypeMessage,
} from "../types";
import { deleteMediaAsset, saveAltText } from "../actions";
import type { MediaUsage } from "../usage";
import type { MediaCardData } from "../types";
import { ImageEditor } from "./image-editor";

type UploadResponse = {
  assets?: MediaCardData[];
  errors?: { name: string; message: string }[];
  error?: string;
  message?: string;
};

const ACCEPT = ALLOWED_MIME_TYPES.join(",");

export function MediaLibrary({ initialAssets }: { initialAssets: MediaCardData[] }) {
  const [assets, setAssets] = useState<MediaCardData[]>(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<MediaCardData | null>(null);
  const [toEdit, setToEdit] = useState<MediaCardData | null>(null);
  const [blockedUsages, setBlockedUsages] = useState<MediaUsage[] | null>(null);
  const [deletePending, startDelete] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  /** Klientská předkontrola: odfiltruje příliš velké / nepodporované soubory. */
  function prescreen(files: File[]): File[] {
    const valid: File[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(tooLargeMessage(file.name));
        continue;
      }
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(unsupportedTypeMessage(file.name));
        continue;
      }
      valid.push(file);
    }
    return valid;
  }

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    let files = prescreen(Array.from(fileList));
    if (files.length === 0) return;
    if (files.length > MAX_BATCH_FILES) {
      toast.error(`Najednou lze nahrát nejvýš ${MAX_BATCH_FILES} souborů.`);
      files = files.slice(0, MAX_BATCH_FILES);
    }

    const form = new FormData();
    for (const file of files) form.append("files", file);

    setUploading(true);
    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });
      const data: UploadResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Upload se nezdařil.");
        return;
      }
      const uploaded = data.assets ?? [];
      if (uploaded.length > 0) {
        setAssets((prev) => [...uploaded, ...prev]);
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

  function saveAlt(asset: MediaCardData, value: string) {
    const next = value.trim();
    if (next === (asset.altText ?? "")) return;
    setAssets((prev) =>
      prev.map((a) => (a.id === asset.id ? { ...a, altText: next || null } : a)),
    );
    void saveAltText({ assetId: asset.id, altText: next }).then((result) => {
      if (!result.ok) toast.error(result.message);
    });
  }

  /** Po úpravě/revertu: nahraď kartu (nový náhled i rozměry) na místě. */
  function onEdited(updated: MediaCardData) {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function confirmDelete() {
    const asset = toDelete;
    if (!asset) return;
    startDelete(async () => {
      const result = await deleteMediaAsset({ assetId: asset.id });
      if (result.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
        setToDelete(null);
        setBlockedUsages(null);
        toast.success("Soubor smazán.");
      } else if (result.error === "in_use") {
        setBlockedUsages(result.usages ?? []);
      } else {
        toast.error(result.message);
        setToDelete(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Nahrávání */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "Nahrávám…" : "Nahrát obrázky"}
        </Button>
        <p className="text-muted-foreground text-sm">
          JPEG, PNG nebo WebP · max {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB ·
          až {MAX_BATCH_FILES} najednou
        </p>
      </div>

      {/* Grid */}
      {assets.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="Zatím žádné obrázky"
          description="Nahrajte první obrázky do své knihovny. Použijete je v portfoliu, na profilu i v přílohách."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden">
                {/* Vlastní <img>, ne next/image: soukromé náhledy se servírují přes
                    chráněnou routu s cookies prohlížeče — next/image je fetchuje
                    serverově bez session, což by u soukromého assetu vrátilo 404. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.altText ?? ""}
                  width={asset.width}
                  height={asset.height}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {asset.edited && (
                  <Badge variant="secondary" className="absolute left-2 top-2">
                    Upraveno
                  </Badge>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="space-y-1">
                  <Label
                    htmlFor={`alt-${asset.id}`}
                    className="text-muted-foreground text-xs"
                  >
                    Alt text
                  </Label>
                  <Input
                    id={`alt-${asset.id}`}
                    defaultValue={asset.altText ?? ""}
                    maxLength={ALT_TEXT_MAX_LENGTH}
                    placeholder="Popis obrázku"
                    onBlur={(e) => saveAlt(asset, e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start"
                    onClick={() => setToEdit(asset)}
                  >
                    <SlidersHorizontal className="size-4" /> Upravit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive flex-1 justify-start"
                    onClick={() => {
                      setBlockedUsages(null);
                      setToDelete(asset);
                    }}
                  >
                    <Trash2 className="size-4" /> Smazat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Potvrzení mazání / blok „použito v publikovaném" */}
      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToDelete(null);
            setBlockedUsages(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {blockedUsages ? "Soubor nelze smazat" : "Smazat soubor?"}
            </DialogTitle>
            <DialogDescription>
              {blockedUsages
                ? "Obrázek je použitý v publikovaném obsahu. Nejdřív ho odeberte z těchto míst:"
                : "Originál zůstane obnovitelný. Soubor se skryje z knihovny."}
            </DialogDescription>
          </DialogHeader>

          {blockedUsages && blockedUsages.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {blockedUsages.map((usage, i) => (
                <li key={i}>
                  {usage.href ? (
                    <Link href={usage.href} className="underline">
                      {usage.label}
                    </Link>
                  ) : (
                    usage.label
                  )}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setToDelete(null);
                setBlockedUsages(null);
              }}
            >
              {blockedUsages ? "Zavřít" : "Zrušit"}
            </Button>
            {!blockedUsages && (
              <Button
                variant="destructive"
                disabled={deletePending}
                onClick={confirmDelete}
              >
                {deletePending && <Loader2 className="size-4 animate-spin" />}
                Smazat
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor úprav obrázku (T015) */}
      <ImageEditor
        asset={toEdit}
        onUpdated={onEdited}
        onClose={() => setToEdit(null)}
      />
    </div>
  );
}
