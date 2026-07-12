import { requireUser } from "@/lib/session";
import { listMyMedia, toMediaCard } from "@/features/media/queries";
import { MediaLibrary } from "@/features/media/components/media-library";

/**
 * T014 — knihovna médií (`/media`). Osobní knihovna přihlášeného uživatele:
 * multi-upload, grid náhledů, alt text a mazání. Náhledy se servírují přes
 * chráněnou routu `/api/media/[id]/thumbnail` (jen vlastník). Vlastní data i
 * viditelnost řeší `listMyMedia`; upload jede přes `/api/media/upload`.
 */
export default async function MediaPage() {
  await requireUser();
  const assets = await listMyMedia();
  const cards = assets.map(toMediaCard);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knihovna médií</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vaše obrázky pro portfolio, profil i přílohy. Originál zůstává vždy
          zachovaný; deriváty se generují automaticky.
        </p>
      </div>

      <MediaLibrary initialAssets={cards} />
    </div>
  );
}
