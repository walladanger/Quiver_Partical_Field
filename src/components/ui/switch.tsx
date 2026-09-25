import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "ui-motion peer inline-flex h-7 w-11 shrink-0 cursor-pointer items-center rounded-full bg-elevated shadow-[var(--shadow-border)] outline-none transition-[background-color] duration-[150ms] ease-[var(--ease-out)]",
        "data-[state=checked]:bg-accent",
        "focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="ui-motion pointer-events-none block size-5 translate-x-1 rounded-full bg-fg transition-transform duration-[150ms] ease-[var(--ease-out)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  );
}
