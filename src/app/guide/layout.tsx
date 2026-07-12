import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

/**
 * Fokusovaný layout guide (T018). Guide je klíčové (a hlavně mobilní) flow, proto
 * má minimální chrome bez marketingové navigace — jen logo a odchod. Je VEŘEJNÝ:
 * projde jím i nepřihlášený návštěvník (vlastnictví session hlídá engine).
 */
export default function GuideLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="ArchiGuide — domů">
            <Logo />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" aria-label="Ukončit průvodce">
              <X /> Ukončit
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
