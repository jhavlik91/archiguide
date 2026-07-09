import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

/** Odhlašovací tlačítko — form volající server action `signOutAction`. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Odhlásit se"
      >
        <LogOut />
      </Button>
    </form>
  );
}
