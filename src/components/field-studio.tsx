import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { FieldCanvas } from "@/components/field-canvas";
import { FieldVolume } from "@/components/field-volume";
import { useEquationStore } from "@/lib/field/equation-store";
import { FieldControls } from "@/components/field-controls";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFieldStore } from "@/lib/field/store";
import { cn } from "@/lib/utils";

export function FieldStudio() {
  const [view, setView] = useState<'2d' | '3d'>('3d');
  const playing = useFieldStore((s) => s.playing);
  const togglePlaying = useFieldStore((s) => s.togglePlaying);
  const reseed = useFieldStore((s) => s.reseed);

  useEffect(() => {
    void useFieldStore.persist.rehydrate();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) useFieldStore.getState().setPlaying(false);
    useFieldStore.getState().setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "SUMMARY") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlaying();
      }
      if (e.key === "r" || e.key === "R") reseed();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlaying, reseed]);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="studio-shell flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">
              Vector field studio
            </p>
            <h1 className="font-display text-3xl leading-tight tracking-tight text-fg italic">
              Quiver
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Field view" className="flex rounded-md border border-border p-1">
              <button type="button" onClick={() => setView('2d')} aria-pressed={view === '2d'} className={cn('h-10 min-w-11 rounded px-2 text-sm', view === '2d' ? 'bg-accent text-accent-fg' : 'text-fg')}>2D</button>
              <button type="button" onClick={() => {useEquationStore.getState().setEnabled(true);setView('3d');}} aria-pressed={view === '3d'} className={cn('h-10 min-w-11 rounded px-2 text-sm', view === '3d' ? 'bg-accent text-accent-fg' : 'text-fg')}>3D</button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={reseed}
              aria-label="Reseed particles"
              className="hidden sm:inline-flex"
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              onClick={togglePlaying}
              aria-label={playing ? "Pause flow" : "Play flow"}
              className="min-w-28"
            >
              <span className="relative inline-flex size-4 items-center justify-center">
                <Pause
                  className={cn(
                    "absolute size-4 transition-[opacity,transform,filter] duration-[250ms] ease-in-out",
                    playing ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
                  )}
                />
                <Play
                  className={cn(
                    "size-4 transition-[opacity,transform,filter] duration-[250ms] ease-in-out",
                    playing ? "scale-[0.25] opacity-0 blur-[4px]" : "ml-px scale-100 opacity-100 blur-none",
                  )}
                />
              </span>
              {playing ? "Pause" : "Play"}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 lg:inset-2 lg:overflow-hidden lg:rounded-lg lg:shadow-[var(--shadow-border)]">
              {view === '3d' ? <FieldVolume /> : <FieldCanvas />}
            </div>
          </div>
          <aside className="studio-panel w-full shrink-0 overflow-y-auto border-t border-border bg-surface px-4 py-4 lg:h-full lg:w-80 lg:border-t-0 lg:border-l lg:px-5 lg:py-5">
            <FieldControls />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
