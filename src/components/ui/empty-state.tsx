import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Optional icon rendered above the title (e.g. a lucide-react icon). */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Optional primary action, typically a <Button>. */
  action?: React.ReactNode;
};

/**
 * The documented empty pattern: shown when a list or view has no content yet.
 * Always give the user a next step via `action` to avoid dead ends
 * (legacy-master-spec §53.1).
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
