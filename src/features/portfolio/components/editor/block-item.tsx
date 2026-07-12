"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PORTFOLIO_BLOCK_LABELS } from "../../blocks";
import { BlockContentEditor } from "./block-inputs";
import type { EditorBlock } from "./types";
import type { MediaCardData } from "@/features/media/components/media-library";

/**
 * Jeden blok v editoru (T013): záhlaví s ovládáním (přeřazení tahem i tlačítky,
 * duplikace, smazání) a tělo s editorem obsahu dle typu. Neúplný blok (nevalidní
 * vůči strict schématu) je označen — nepublikuje se, dokud ho autor nedoplní.
 */
export function BlockItem({
  block,
  index,
  total,
  publishable,
  assets,
  onAssetsChange,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragTarget,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  publishable: boolean;
  assets: MediaCardData[];
  onAssetsChange: (next: MediaCardData[]) => void;
  onChange: (content: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragTarget: boolean;
}) {
  const [draggable, setDraggable] = useState(false);

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={() => {
        setDraggable(false);
        onDrop();
      }}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      data-block-type={block.type}
      className={cn(
        "bg-background border-border rounded-lg border shadow-sm",
        isDragTarget && "border-primary ring-primary/30 ring-2",
      )}
    >
      <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          aria-label="Přesunout blok tažením"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
          onMouseDown={() => setDraggable(true)}
          onMouseUp={() => setDraggable(false)}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-sm font-medium">
          {PORTFOLIO_BLOCK_LABELS[block.type]}
        </span>
        {!publishable && (
          <Badge variant="warning" className="text-[10px]">
            Neúplný
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Nahoru"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Dolů"
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Duplikovat"
            onClick={onDuplicate}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive size-8"
            aria-label="Smazat"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <BlockContentEditor
          block={block}
          assets={assets}
          onAssetsChange={onAssetsChange}
          onChange={onChange}
        />
      </div>
    </li>
  );
}
