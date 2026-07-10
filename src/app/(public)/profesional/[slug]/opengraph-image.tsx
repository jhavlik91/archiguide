import { ImageResponse } from "next/og";
import { getPublicProfileBySlug } from "@/features/profiles/service";

/**
 * Dynamický OG obrázek veřejného profilu (T008 § Main flow: „OG obrázek").
 * Generuje se serverově z titulku + hlavní profese. Nikdy nevyhazuje — u
 * neexistujícího/skrytého profilu spadne na obecný branding.
 */

export const alt = "Profil profesionála na ArchiGuide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  // Nezveřejněný profil (draft i deaktivovaný/smazaný vlastník — stejná
  // pravidla jako stránka, viz resolvePublicView) OG kartu nedostane.
  const visible =
    profile?.status === "published" && profile.user.status === "active";
  const title = (visible && profile?.headline?.trim()) || "ArchiGuide";
  const primary =
    (visible &&
      profile?.professions.find((p) => p.isPrimary)?.profession.name) ||
    "Odborníci ve stavebnictví a designu";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
          ArchiGuide
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {title}
          </div>
          <div style={{ fontSize: 38, color: "#94a3b8" }}>{primary}</div>
        </div>
      </div>
    ),
    size,
  );
}
