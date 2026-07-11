import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  isIndexable,
  resolvePublicView,
  SNAPSHOT_VERSION,
  type SnapshotSource,
} from "./public-view";

const source: SnapshotSource = {
  title: "Rodinný dům",
  projectType: "realization",
  location: "Brno",
  year: 2024,
  description: "Perex",
  visibility: "public",
  contentBlocks: [{ type: "text", value: "ahoj" }],
};

describe("buildSnapshot", () => {
  it("zmrazí metadata i obsah s časem pořízení", () => {
    const at = new Date("2026-07-11T10:00:00Z");
    const snap = buildSnapshot(source, at);
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.title).toBe("Rodinný dům");
    expect(snap.contentBlocks).toHaveLength(1);
    expect(snap.snapshotAt).toBe(at.toISOString());
  });
});

describe("resolvePublicView", () => {
  it("publikované nesmazané dílo je veřejné", () => {
    const view = resolvePublicView({
      status: "published",
      deleted: false,
      ownerActive: true,
      isEditor: false,
      preview: false,
    });
    expect(view).toEqual({ visible: true, mode: "public" });
    expect(isIndexable(view)).toBe(true);
  });

  it("draft je viditelný jen editorovi v náhledu", () => {
    const base = {
      status: "draft" as const,
      deleted: false,
      ownerActive: true,
    };
    expect(
      resolvePublicView({ ...base, isEditor: true, preview: true }),
    ).toEqual({ visible: true, mode: "preview" });
    expect(
      resolvePublicView({ ...base, isEditor: true, preview: false }),
    ).toEqual({ visible: false });
    expect(
      resolvePublicView({ ...base, isEditor: false, preview: true }),
    ).toEqual({ visible: false });
  });

  it("smazané nebo neaktivní vlastník → nedostupné", () => {
    expect(
      resolvePublicView({
        status: "published",
        deleted: true,
        ownerActive: true,
        isEditor: true,
        preview: true,
      }),
    ).toEqual({ visible: false });
    expect(
      resolvePublicView({
        status: "published",
        deleted: false,
        ownerActive: false,
        isEditor: false,
        preview: false,
      }),
    ).toEqual({ visible: false });
  });

  it("preview draftu se neindexuje", () => {
    const view = resolvePublicView({
      status: "draft",
      deleted: false,
      ownerActive: true,
      isEditor: true,
      preview: true,
    });
    expect(isIndexable(view)).toBe(false);
  });
});
