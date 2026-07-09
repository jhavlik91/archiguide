import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/**
 * Placeholder button for the scaffold. Replaced by the shadcn/ui design system
 * in T006 — kept intentionally dependency-free so T001 stays self-contained.
 */
export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
        variant === "primary"
          ? "bg-foreground text-background hover:opacity-90"
          : "border-foreground/20 hover:bg-foreground/5 border",
        className,
      )}
      {...props}
    />
  );
}
