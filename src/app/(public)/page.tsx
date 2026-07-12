import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GuideResumeBanner } from "@/features/guide/components/guide-resume-banner";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:px-6">
      <div className="w-full text-left">
        <GuideResumeBanner />
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        ArchiGuide
      </h1>
      <p className="text-muted-foreground text-lg">
        Platforma propojující investory s architekty a profesionály ve
        stavebnictví.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/guide">Spustit průvodce</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/register">Začít zdarma</Link>
        </Button>
      </div>
      <p className="text-muted-foreground/70 text-sm">
        Nevíte si rady? Průvodce vás pár otázkami dovede k jasnému zadání — i
        bez registrace.
      </p>
    </main>
  );
}
