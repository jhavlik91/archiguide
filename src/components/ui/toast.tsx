"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * App-wide toast host. Mount once near the root of each layout; trigger toasts
 * imperatively with `toast(...)`. This is the documented error/success feedback
 * pattern (see State Patterns in Storybook).
 */
function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border group-[.toaster]:shadow-lg group-[.toaster]:rounded-md",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!border-destructive/40 group-[.toaster]:!text-destructive",
          success: "group-[.toaster]:!border-success/40",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
