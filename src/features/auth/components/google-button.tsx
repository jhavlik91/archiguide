import { Button } from "@/components/ui/button";
import { googleSignIn } from "../actions";

/** Tlačítko pro přihlášení/registraci přes Google. */
export function GoogleButton({
  label = "Pokračovat přes Google",
}: {
  label?: string;
}) {
  return (
    <form action={googleSignIn}>
      <Button type="submit" variant="outline" className="w-full">
        {label}
      </Button>
    </form>
  );
}

/** Oddělovač „nebo“ mezi OAuth a formulářem. */
export function OrSeparator() {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs">nebo</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
