import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "ui-motion h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none",
        "placeholder:text-subtle",
        "transition-[box-shadow] duration-[150ms] ease-[var(--ease-out)]",
        "focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
