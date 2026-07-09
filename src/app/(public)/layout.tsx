import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-area="public" className="flex min-h-dvh flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} ArchiGuide</span>
          <nav aria-label="Patička" className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Podmínky
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Soukromí
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Kontakt
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
