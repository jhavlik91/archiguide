"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Loader2,
  RotateCcw,
  RotateCw,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { applyImageEdit, loadImageEditor, revertImageEdit } from "../actions";
import {
  ADJUST_MAX,
  ADJUST_MIN,
  CROP_PRESETS,
  checkCrop,
  NEUTRAL_EDIT,
  SATURATION_MAX,
  SATURATION_MIN,
  isNeutralEdit,
  type CropPreset,
  type ImageEdit,
  type Rotation,
} from "../edit";
import type { MediaCardData } from "../types";

/** Popisky presetů poměru stran. */
const CROP_LABELS: Record<CropPreset, string> = {
  free: "Volný",
  "1:1": "1:1",
  "4:3": "4:3",
  "16:9": "16:9",
};

/** Otočí rotaci o ±90° (drží ji v {0,90,180,270}). */
function turn(rotate: Rotation, delta: 90 | -90): Rotation {
  return (((rotate + delta + 360) % 360) as Rotation);
}

type Loaded = {
  baseWebUrl: string;
  baseWidth: number;
  baseHeight: number;
  usedInPublished: boolean;
};

export function ImageEditor({
  asset,
  onUpdated,
  onClose,
}: {
  asset: MediaCardData | null;
  onUpdated: (asset: MediaCardData) => void;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [edit, setEdit] = useState<ImageEdit>(NEUTRAL_EDIT);
  const [saving, startSave] = useTransition();
  const [reverting, startRevert] = useTransition();

  const assetId = asset?.id ?? null;

  // Načte kontext editoru při otevření (parametry se skládají vždy z originálu).
  useEffect(() => {
    if (!assetId) return;
    let active = true;
    setLoaded(null);
    setEdit(NEUTRAL_EDIT);
    void loadImageEditor({ assetId }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        toast.error(result.message);
        onClose();
        return;
      }
      setEdit(result.context.edit);
      setLoaded({
        baseWebUrl: result.context.baseWebUrl,
        baseWidth: result.context.baseWidth,
        baseHeight: result.context.baseHeight,
        usedInPublished: result.context.usedInPublished,
      });
    });
    return () => {
      active = false;
    };
  }, [assetId, onClose]);

  function save() {
    if (!assetId) return;
    startSave(async () => {
      const result = await applyImageEdit({ assetId, edit });
      if (result.ok) {
        onUpdated(result.asset);
        toast.success("Úpravy uloženy.");
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  }

  function revert() {
    if (!assetId) return;
    startRevert(async () => {
      const result = await revertImageEdit({ assetId });
      if (result.ok) {
        onUpdated(result.asset);
        toast.success("Obnoven originál.");
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  }

  const busy = saving || reverting;
  const dirty = !isNeutralEdit(edit);

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upravit obrázek</DialogTitle>
          <DialogDescription>
            Uložením vznikne nová verze; originál zůstává zachovaný a lze se k němu
            kdykoli vrátit.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
            {/* Náhled */}
            <div className="space-y-3">
              {loaded.usedInPublished && (
                <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
                  Obrázek je použitý v publikovaném obsahu — úprava se tam projeví
                  hned po uložení.
                </p>
              )}
              <div className="bg-muted relative grid h-64 place-items-center overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={loaded.baseWebUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain transition-[filter,transform]"
                  style={{
                    filter: `brightness(${edit.brightness}) contrast(${edit.contrast}) saturate(${edit.saturation})`,
                    transform: `rotate(${edit.rotate}deg)`,
                  }}
                />
                {edit.crop !== "free" && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                    style={{
                      aspectRatio: edit.crop.replace(":", " / "),
                      maxWidth: "88%",
                      maxHeight: "88%",
                      width: "88%",
                      height: "88%",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Ovládání */}
            <div className="space-y-5">
              {/* Rotace */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Rotace</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Otočit doleva"
                    onClick={() => setEdit((e) => ({ ...e, rotate: turn(e.rotate, -90) }))}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Otočit doprava"
                    onClick={() => setEdit((e) => ({ ...e, rotate: turn(e.rotate, 90) }))}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {edit.rotate}°
                  </span>
                </div>
              </div>

              {/* Poměr stran (crop) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Poměr stran</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CROP_PRESETS.map((preset) => {
                    const tooSmall =
                      preset !== "free" &&
                      !checkCrop(loaded.baseWidth, loaded.baseHeight, {
                        ...edit,
                        crop: preset,
                      }).ok;
                    return (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={edit.crop === preset ? "primary" : "outline"}
                        disabled={tooSmall}
                        onClick={() => setEdit((e) => ({ ...e, crop: preset }))}
                      >
                        {CROP_LABELS[preset]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Barevné úpravy */}
              <Slider
                label="Jas"
                min={ADJUST_MIN}
                max={ADJUST_MAX}
                value={edit.brightness}
                onChange={(v) => setEdit((e) => ({ ...e, brightness: v }))}
              />
              <Slider
                label="Kontrast"
                min={ADJUST_MIN}
                max={ADJUST_MAX}
                value={edit.contrast}
                onChange={(v) => setEdit((e) => ({ ...e, contrast: v }))}
              />
              <Slider
                label="Saturace"
                min={SATURATION_MIN}
                max={SATURATION_MAX}
                value={edit.saturation}
                onChange={(v) => setEdit((e) => ({ ...e, saturation: v }))}
              />
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={busy || !asset?.edited}
            onClick={revert}
          >
            {reverting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            Vrátit originál
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Zrušit
            </Button>
            <Button type="button" disabled={busy || !loaded || !dirty} onClick={save}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Uložit úpravy
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Jednoduchý posuvník (nativní range) s popiskem, hodnotou a resetem na neutrální 1. */
function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">{label}</Label>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs tabular-nums"
          onClick={() => onChange(1)}
          title="Vrátit na neutrální"
        >
          {value.toFixed(2)}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary h-1.5 w-full cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}
