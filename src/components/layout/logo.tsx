import * as React from "react";
import { cn } from "@/lib/utils";

/** Wordmark used across all layouts. */
function Logo({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-bold tracking-tight",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-sm"
      >
        A
      </span>
      ArchiGuide
    </span>
  );
}

export { Logo };
