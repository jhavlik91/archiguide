import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type VerificationType,
  VERIFICATION_LABELS,
} from "../rules";

/**
 * Odznaky ověření (T011). Přesně uvádějí, **co** bylo ověřeno (§37), a nikdy
 * nezobrazují samotný kontakt — dostávají jen seznam ověřených typů. Veřejně
 * čitelné; použijí veřejné stránky profilu/firmy (T008/T010).
 */
export function VerificationBadges({
  types,
  className,
}: {
  types: readonly VerificationType[];
  className?: string;
}) {
  if (types.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {types.map((type) => (
        <li key={type}>
          <Badge variant="success" className="gap-1">
            <BadgeCheck className="size-3.5" aria-hidden />
            {VERIFICATION_LABELS[type]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
