import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGuideAccessor } from "../accessor";
import { findResumableSession } from "../service";
import { resumeGuide } from "../actions";

/**
 * Banner „Rozpracovaný záměr" (T018). Async server komponenta — najde nejnovější
 * rozpracovanou (`active`) session žadatele (přihlášeného dle userId nebo anonyma
 * dle cookie tokenu) a nabídne návrat do runneru. Když nic neběží, nevykreslí nic.
 * Vhodné na homepage i dashboard.
 */
export async function GuideResumeBanner() {
  const accessor = await getGuideAccessor();
  const resume = await findResumableSession(accessor);
  if (!resume) return null;

  const pct = Math.round(resume.ratio * 100);

  return (
    <div className="border-primary/30 bg-primary/5 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Compass className="size-5" />
        </span>
        <div className="space-y-0.5">
          <p className="font-medium">Rozpracovaný záměr</p>
          <p className="text-muted-foreground text-sm">
            {resume.scenarioName} — hotovo {pct} % ({resume.answered} z{" "}
            {resume.total} otázek).
          </p>
        </div>
      </div>
      <form
        action={resumeGuide.bind(null, resume.sessionId)}
        className="shrink-0"
      >
        <Button type="submit">
          Pokračovat <ArrowRight />
        </Button>
      </form>
    </div>
  );
}
