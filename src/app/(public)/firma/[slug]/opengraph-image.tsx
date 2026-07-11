import { ImageResponse } from "next/og";
import { getPublicOrganizationBySlug } from "@/features/organizations/service";
import { isOrgPubliclyVisible } from "@/features/organizations/public-view";

/**
 * Dynamický OG obrázek veřejné firemní stránky (T010 § Main flow: „SEO metadata").
 * Generuje se serverově z názvu + sídla. Nikdy nevyhazuje — u neexistující/skryté
 * (archivované) firmy spadne na obecný branding (stejná pravidla jako stránka).
 */

export const alt = "Firemní profil na ArchiGuide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getPublicOrganizationBySlug(slug);
  const visible = org != null && isOrgPubliclyVisible(org.status);
  const title = (visible && org?.name.trim()) || "ArchiGuide";
  const subtitle =
    (visible && org?.location?.trim()) || "Odborníci ve stavebnictví a designu";

  return new ImageResponse(
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
        <div style={{ fontSize: 38, color: "#94a3b8" }}>{subtitle}</div>
      </div>
    </div>,
    size,
  );
}
