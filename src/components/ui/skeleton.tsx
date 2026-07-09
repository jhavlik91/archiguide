import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Compose several to mirror the shape of the content that
 * is loading — the documented loading pattern for the app (see State Patterns
 * in Storybook).
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
