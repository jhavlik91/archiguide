import "server-only";

import { getActor } from "@/lib/session";
import { type Actor } from "@/lib/permissions";
import { roleAtLeast } from "@/features/organizations/rules";
import { getMembershipRole } from "@/features/organizations/service";
import {
  canManageMedia,
  canUploadMedia,
  canViewMedia,
  type MediaViewSubject,
} from "./permissions";
import { getAssetById, listActiveAssets, type MediaAssetRow } from "./service";
import { ownerRefOf, type MediaOwnerRef } from "./rules";
import { isUsedInPublished } from "./usage";
import { MIME_EXTENSION, type MediaVariant } from "./types";

/**
 * Čtecí/autorizační vrstva médií (T014) pro stránky a serve/upload routy. Vynucuje
 * viditelnost (vlastník vs. veřejný derivát) a sestavuje permission `subject`
 * z DB. Firemní roli actora čte z modulu organizací (T009) — přes resolver, ať
 * jde v testech podvrhnout (stejný vzor jako portfolio/queries).
 */

export type OrgMembership = { isMember: boolean; isEditor: boolean };

let orgMembershipResolver: (
  orgId: string,
  userId: string,
) => Promise<OrgMembership> = async (orgId, userId) => {
  const role = await getMembershipRole(orgId, userId);
  return { isMember: role !== null, isEditor: roleAtLeast(role, "editor") };
};

/** Testy si můžou zjištění firemní role actora podvrhnout. */
export function __setOrgMembershipResolver(
  resolver: (orgId: string, userId: string) => Promise<OrgMembership>,
): void {
  orgMembershipResolver = resolver;
}

// --- Knihovna ---------------------------------------------------------------

/** Aktivní média přihlášeného uživatele (jeho osobní knihovna). Návštěvník → []. */
export async function listMyMedia(): Promise<MediaAssetRow[]> {
  const actor = await getActor();
  if (actor.kind !== "user") return [];
  return listActiveAssets({ type: "user", userId: actor.userId });
}

// --- Upload -----------------------------------------------------------------

export type ResolvedUploadOwner =
  | { ok: true; owner: MediaOwnerRef; isOrgEditor: boolean }
  | { ok: false };

/**
 * Ověří, že actor smí nahrávat pro daného vlastníka, a vrátí owner ref. Bez
 * `ownerOrgId` je vlastníkem sám uživatel; s ním firemní vlastník (vyžaduje
 * editor+). Vrací `ok:false`, pokud actor nemá oprávnění.
 */
export async function resolveUploadOwner(
  ownerOrgId: string | undefined,
): Promise<ResolvedUploadOwner> {
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false };

  if (!ownerOrgId) {
    const owner: MediaOwnerRef = { type: "user", userId: actor.userId };
    return canUploadMedia(actor, { owner })
      ? { ok: true, owner, isOrgEditor: false }
      : { ok: false };
  }

  const membership = await orgMembershipResolver(ownerOrgId, actor.userId);
  const owner: MediaOwnerRef = { type: "organization", orgId: ownerOrgId };
  return canUploadMedia(actor, { owner, isOrgEditor: membership.isEditor })
    ? { ok: true, owner, isOrgEditor: membership.isEditor }
    : { ok: false };
}

// --- Správa (mazání, alt text) ----------------------------------------------

/**
 * Asset, který actor smí spravovat (mazat, alt text). Vrací `null`, pokud asset
 * neexistuje, je smazaný, nebo na něj actor nemá právo.
 */
export async function getManageableAsset(
  assetId: string,
): Promise<MediaAssetRow | null> {
  const [actor, asset] = await Promise.all([getActor(), getAssetById(assetId)]);
  if (!asset || asset.status !== "active") return null;

  const owner = ownerRefOf(asset);
  let isOrgEditor = false;
  if (owner.type === "organization" && actor.kind === "user") {
    isOrgEditor = (await orgMembershipResolver(owner.orgId, actor.userId)).isEditor;
  }
  if (!canManageMedia(actor, { owner, isOrgEditor })) return null;
  return asset;
}

// --- Servírování ------------------------------------------------------------

export type ServableFile = {
  key: string;
  contentType: string;
  /** Deriváty (veřejné, immutable) lze dlouho cachovat; originál jen soukromě. */
  cacheControl: string;
};

/**
 * Vyhodnotí požadavek na servírování varianty assetu a vrátí storage klíč +
 * hlavičky, nebo `null` (nedostupné / bez oprávnění). Originál dostane jen
 * vlastník; derivát i veřejnost, když je asset použitý v publikovaném obsahu.
 */
export async function resolveServableFile(
  assetId: string,
  variant: MediaVariant,
): Promise<ServableFile | null> {
  const [actor, asset] = await Promise.all([getActor(), getAssetById(assetId)]);
  if (!asset) return null;

  const key =
    variant === "original"
      ? asset.originalKey
      : variant === "thumbnail"
        ? asset.thumbnailKey
        : asset.webKey;
  if (!key) return null;

  const owner = ownerRefOf(asset);
  const subject: MediaViewSubject = { owner };

  if (owner.type === "organization" && actor.kind === "user") {
    subject.isOrgMember = (
      await orgMembershipResolver(owner.orgId, actor.userId)
    ).isMember;
  }

  // Veřejný derivát: jen deriváty aktivního assetu použitého v publikovaném obsahu.
  if (variant !== "original" && asset.status === "active") {
    subject.isPublicDerivative = await isUsedInPublished(assetId);
  }

  if (!canViewMedia(actor as Actor, subject)) return null;

  const contentType =
    variant === "original" ? asset.mimeType : "image/webp";
  // Deriváty veřejně použitého assetu jsou immutable (klíč se nemění) → dlouhá
  // cache; ostatní (soukromé/originál) drž jen v privátní cache prohlížeče.
  const cacheControl = subject.isPublicDerivative
    ? "public, max-age=31536000, immutable"
    : "private, no-cache";

  return { key, contentType, cacheControl };
}

/** Přípona pro daný variant (diagnostika / testy). */
export function variantExtension(asset: MediaAssetRow, variant: MediaVariant): string {
  if (variant === "original") return MIME_EXTENSION[asset.mimeType as keyof typeof MIME_EXTENSION] ?? "bin";
  return "webp";
}
