"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  defaultBlockContent,
  isBlockPublishable,
  PORTFOLIO_BLOCK_HINTS,
  PORTFOLIO_BLOCK_LABELS,
  PORTFOLIO_BLOCK_TYPES,
  type DraftPortfolioBlock,
  type PortfolioBlockKind,
} from "../../blocks";
import {
  logPortfolioBlockAdded,
  logPortfolioPreviewUsed,
} from "../../blocks-actions";
import type { MediaCardData } from "@/features/media/types";
import { BlockItem } from "./block-item";
import { BlockPreview } from "./block-preview";
import { useAutosave, type SaveStatus } from "./use-autosave";
import { newBlockId, type EditorBlock } from "./types";

// --- Undo/redo reducer ------------------------------------------------------
//
// Historie cílí na STRUKTURU (přidání/smazání/duplikace/přeřazení, T013 § AC).
// Úpravy obsahu se propisují bez záznamu do historie (pole jsou neřízená), ale
// invalidují redo, aby se strukturální redo neaplikoval na jiný obsah.

const HISTORY_LIMIT = 100;

type EditorState = {
  blocks: EditorBlock[];
  past: EditorBlock[][];
  future: EditorBlock[][];
};

type EditorAction =
  | { type: "add"; kind: PortfolioBlockKind }
  | { type: "update"; id: string; content: Record<string, unknown> }
  | { type: "delete"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "move"; from: number; to: number }
  | { type: "undo" }
  | { type: "redo" };

/** Zapíše nový stav bloků a odsune předchozí do historie (redo se vymaže). */
function commit(state: EditorState, blocks: EditorBlock[]): EditorState {
  return {
    blocks,
    past: [...state.past, state.blocks].slice(-HISTORY_LIMIT),
    future: [],
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "add":
      return commit(state, [
        ...state.blocks,
        {
          id: newBlockId(),
          type: action.kind,
          content: defaultBlockContent(action.kind) as Record<string, unknown>,
        },
      ]);

    case "update":
      // Bez záznamu do historie; jen zneplatní redo.
      return {
        ...state,
        future: [],
        blocks: state.blocks.map((block) =>
          block.id === action.id
            ? { ...block, content: action.content }
            : block,
        ),
      };

    case "delete":
      return commit(
        state,
        state.blocks.filter((block) => block.id !== action.id),
      );

    case "duplicate": {
      const index = state.blocks.findIndex((b) => b.id === action.id);
      if (index === -1) return state;
      const copy: EditorBlock = {
        ...state.blocks[index],
        id: newBlockId(),
        content: structuredClone(state.blocks[index].content),
      };
      const next = [...state.blocks];
      next.splice(index + 1, 0, copy);
      return commit(state, next);
    }

    case "move": {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0) return state;
      const next = [...state.blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return commit(state, next);
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        blocks: previous,
        past: state.past.slice(0, -1),
        future: [state.blocks, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        blocks: next,
        past: [...state.past, state.blocks].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
  }
}

const toDraft = (blocks: EditorBlock[]): DraftPortfolioBlock[] =>
  blocks.map((block) => ({ type: block.type, content: block.content }));

// --- Save status pill -------------------------------------------------------

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<
    SaveStatus,
    { label: string; icon: React.ReactNode; className: string }
  > = {
    saved: {
      label: "Uloženo",
      icon: <Check className="size-4" />,
      className: "text-success",
    },
    pending: {
      label: "Neuložené změny",
      icon: <Save className="size-4" />,
      className: "text-muted-foreground",
    },
    saving: {
      label: "Ukládám…",
      icon: <Loader2 className="size-4 animate-spin" />,
      className: "text-muted-foreground",
    },
    error: {
      label: "Chyba ukládání — zkouším znovu",
      icon: <AlertTriangle className="size-4" />,
      className: "text-destructive",
    },
    conflict: {
      label: "Uloženo — pozor, existovala novější verze",
      icon: <AlertTriangle className="size-4" />,
      className: "text-warning",
    },
  };
  const s = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-sm font-medium", s.className)}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

// --- Palette ----------------------------------------------------------------

function BlockPalette({ onAdd }: { onAdd: (kind: PortfolioBlockKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        <Plus className="size-4" /> Přidat blok
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="bg-popover border-border absolute left-0 z-20 mt-1 grid w-72 grid-cols-1 gap-1 rounded-md border p-1 shadow-md">
            {PORTFOLIO_BLOCK_TYPES.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  onAdd(kind);
                  setOpen(false);
                }}
                className="hover:bg-accent flex flex-col rounded-sm px-3 py-2 text-left"
              >
                <span className="text-sm font-medium">
                  {PORTFOLIO_BLOCK_LABELS[kind]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {PORTFOLIO_BLOCK_HINTS[kind]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Editor -----------------------------------------------------------------

/**
 * Blokový editor portfolia (T013). Drží dokument bloků, autosave (viz
 * `useAutosave`), undo/redo a živý náhled. Souběžnou editaci řeší server
 * (last-write-wins) a hlásí ji přes stav „conflict".
 */
export function BlockEditor({
  projectId,
  initialBlocks,
  initialVersion,
  initialAssets,
}: {
  projectId: string;
  initialBlocks: EditorBlock[];
  initialVersion: number;
  initialAssets: MediaCardData[];
}) {
  const [state, dispatch] = useReducer(
    reducer,
    { blocks: initialBlocks, past: [], future: [] } satisfies EditorState,
  );
  const [assets, setAssets] = useState<MediaCardData[]>(initialAssets);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const blocksRef = useRef<DraftPortfolioBlock[]>(toDraft(initialBlocks));
  const autosave = useAutosave(projectId, blocksRef, initialVersion);
  const { markDirty, saveNow, status } = autosave;

  // Ref na aktuální bloky pro flush autosave.
  useEffect(() => {
    blocksRef.current = toDraft(state.blocks);
  }, [state.blocks]);

  // Jakákoli změna bloků (i undo/redo) naplánuje uložení; první render vynecháme.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) markDirty();
    else mounted.current = true;
  }, [state.blocks, markDirty]);

  // Varuj před opuštěním s neuloženými změnami (žádná tichá ztráta dat).
  useEffect(() => {
    if (status === "saved") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // Klávesové zkratky undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if (
        (e.key.toLowerCase() === "z" && e.shiftKey) ||
        e.key.toLowerCase() === "y"
      ) {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addBlock = useCallback(
    (kind: PortfolioBlockKind) => {
      dispatch({ type: "add", kind });
      void logPortfolioBlockAdded(projectId, kind);
    },
    [projectId],
  );

  const enterPreview = useCallback(() => {
    setMode("preview");
    void logPortfolioPreviewUsed(projectId);
  }, [projectId]);

  return (
    <div className="space-y-4">
      {/* Panel nástrojů */}
      <div className="flex flex-wrap items-center gap-2">
        {mode === "edit" ? (
          <BlockPalette onAdd={addBlock} />
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant={viewport === "desktop" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport("desktop")}
            >
              <Monitor className="size-4" /> Desktop
            </Button>
            <Button
              variant={viewport === "mobile" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewport("mobile")}
            >
              <Smartphone className="size-4" /> Mobil
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zpět"
            disabled={state.past.length === 0}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Znovu"
            disabled={state.future.length === 0}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Redo2 className="size-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator status={status} />
          <Button
            variant="outline"
            size="sm"
            onClick={saveNow}
            disabled={status === "saved" || status === "saving"}
          >
            <Save className="size-4" /> Uložit teď
          </Button>
          {mode === "edit" ? (
            <Button variant="secondary" size="sm" onClick={enterPreview}>
              <Eye className="size-4" /> Náhled
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMode("edit")}
            >
              <Pencil className="size-4" /> Editor
            </Button>
          )}
        </div>
      </div>

      {/* Obsah */}
      {mode === "preview" ? (
        <BlockPreview blocks={state.blocks} viewport={viewport} />
      ) : state.blocks.length === 0 ? (
        <EmptyState
          icon={<Plus />}
          title="Zatím žádné bloky"
          description="Sestavte dílo z bloků – nadpisy, text, obrázky, galerie, před/po a další. Začněte tlačítkem „Přidat blok“."
        />
      ) : (
        <ul className="space-y-3">
          {state.blocks.map((block, index) => (
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              total={state.blocks.length}
              publishable={isBlockPublishable({
                type: block.type,
                content: block.content,
              })}
              assets={assets}
              onAssetsChange={setAssets}
              onChange={(content) =>
                dispatch({ type: "update", id: block.id, content })
              }
              onDuplicate={() => dispatch({ type: "duplicate", id: block.id })}
              onDelete={() => dispatch({ type: "delete", id: block.id })}
              onMoveUp={() =>
                dispatch({ type: "move", from: index, to: index - 1 })
              }
              onMoveDown={() =>
                dispatch({ type: "move", from: index, to: index + 1 })
              }
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={() => {
                const from = dragIndex.current;
                if (from !== null && from !== index) {
                  dispatch({ type: "move", from, to: index });
                }
                dragIndex.current = null;
                setOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setOverIndex(null);
              }}
              isDragTarget={overIndex === index && dragIndex.current !== index}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
