import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-elevated shadow-[var(--shadow-border)]">
        <SliderPrimitive.Range className="absolute h-full bg-accent/80" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-motion block size-4 rounded-full bg-fg shadow-[var(--shadow-border)] outline-none transition-[transform,box-shadow] duration-[150ms] ease-[var(--ease-out)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg" />
    </SliderPrimitive.Root>
  );
}
