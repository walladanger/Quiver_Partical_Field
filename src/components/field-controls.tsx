import { type ReactNode, useMemo } from "react";
import { CircleHelp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compileField } from "@/lib/field/math";
import { FIELD_PRESETS } from "@/lib/field/presets";
import { useFieldStore } from "@/lib/field/store";
import { cn } from "@/lib/utils";
import { EquationControls } from "@/components/equation-controls";

function Control({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-xs tabular-nums text-subtle">{value}</span>
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center justify-between gap-3 rounded-md px-1">
      <span className="text-sm text-fg">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

export function FieldControls() {
  const vxSrc = useFieldStore((s) => s.vxSrc);
  const vySrc = useFieldStore((s) => s.vySrc);
  const presetId = useFieldStore((s) => s.presetId);
  const density = useFieldStore((s) => s.density);
  const arrowScale = useFieldStore((s) => s.arrowScale);
  const normalize = useFieldStore((s) => s.normalize);
  const particleCount = useFieldStore((s) => s.particleCount);
  const speed = useFieldStore((s) => s.speed);
  const trails = useFieldStore((s) => s.trails);
  const showArrows = useFieldStore((s) => s.showArrows);
  const showHeat = useFieldStore((s) => s.showHeat);
  const colorMode = useFieldStore((s) => s.colorMode);
  const range = useFieldStore((s) => s.range);
  const setVx = useFieldStore((s) => s.setVx);
  const setVy = useFieldStore((s) => s.setVy);
  const applyPreset = useFieldStore((s) => s.applyPreset);
  const setDensity = useFieldStore((s) => s.setDensity);
  const setArrowScale = useFieldStore((s) => s.setArrowScale);
  const setNormalize = useFieldStore((s) => s.setNormalize);
  const setParticleCount = useFieldStore((s) => s.setParticleCount);
  const setSpeed = useFieldStore((s) => s.setSpeed);
  const setTrails = useFieldStore((s) => s.setTrails);
  const setShowArrows = useFieldStore((s) => s.setShowArrows);
  const setShowHeat = useFieldStore((s) => s.setShowHeat);
  const setColorMode = useFieldStore((s) => s.setColorMode);
  const setRange = useFieldStore((s) => s.setRange);
  const reseed = useFieldStore((s) => s.reseed);

  const compiled = useMemo(() => compileField(vxSrc, vySrc), [vxSrc, vySrc]);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Presets</h2>
          {presetId === "custom" ? (
            <span className="font-mono text-xs text-sand">Custom</span>
          ) : null}
        </div>
        <div className="preset-rail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FIELD_PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <Tooltip key={p.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={cn(
                      "ui-motion h-10 shrink-0 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-[150ms] ease-[var(--ease-out)]",
                      active
                        ? "bg-accent text-accent-fg"
                        : "text-fg shadow-[var(--shadow-border)] hover:bg-elevated",
                    )}
                  >
                    {p.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{p.hint}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Field</h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Expression help" className="size-9">
                <CircleHelp className="size-4 text-muted" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="font-mono text-xs leading-relaxed text-muted">
              <p className="font-sans text-sm text-fg">Type a formula for each component.</p>
              <p className="mt-2">
                Variables: <span className="text-fg">x y t r theta</span>
              </p>
              <p>
                Constants: <span className="text-fg">pi e tau</span>
              </p>
              <p className="mt-2">
                sin cos tan atan2 exp log sqrt abs min max pow hypot
              </p>
              <p className="mt-2 font-sans text-muted">
                Multiply with * · power with ^ · time with t
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-2">
          <EqInput
            symbol="Vx"
            value={vxSrc}
            error={compiled.errorVx}
            onChange={setVx}
          />
          <EqInput
            symbol="Vy"
            value={vySrc}
            error={compiled.errorVy}
            onChange={setVy}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-subtle">
          F(x, y) = (Vx, Vy) · r = √(x²+y²)
        </p>
      </section>

      <Separator />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Control label="Arrow density" value={String(Math.round(density))}>
          <Slider
            min={8}
            max={36}
            step={1}
            value={[density]}
            onValueChange={(v) => setDensity(v[0] ?? density)}
            aria-label="Arrow density"
          />
        </Control>
        <Control label="Arrow length" value={arrowScale.toFixed(2)}>
          <Slider
            min={0.3}
            max={1.4}
            step={0.02}
            value={[arrowScale]}
            onValueChange={(v) => setArrowScale(v[0] ?? arrowScale)}
            aria-label="Arrow length"
          />
        </Control>
        <Control label="Particles" value={String(Math.round(particleCount))}>
          <Slider
            min={40}
            max={900}
            step={10}
            value={[particleCount]}
            onValueChange={(v) => setParticleCount(v[0] ?? particleCount)}
            aria-label="Particle count"
          />
        </Control>
        <Control label="Flow speed" value={speed.toFixed(2)}>
          <Slider
            min={0.15}
            max={2.4}
            step={0.05}
            value={[speed]}
            onValueChange={(v) => setSpeed(v[0] ?? speed)}
            aria-label="Flow speed"
          />
        </Control>
        <Control label="Window" value={`±${range.toFixed(1)}`}>
          <Slider
            min={1.5}
            max={10}
            step={0.5}
            value={[range]}
            onValueChange={(v) => setRange(v[0] ?? range)}
            aria-label="Plot window"
          />
        </Control>
      </section>

      <section className="grid grid-cols-1 gap-1">
        <Toggle label="Normalize arrows" checked={normalize} onCheckedChange={setNormalize} />
        <Toggle label="Show arrows" checked={showArrows} onCheckedChange={setShowArrows} />
        <Toggle label="Heat map" checked={showHeat} onCheckedChange={setShowHeat} />
        <Toggle label="Particle trails" checked={trails} onCheckedChange={setTrails} />
      </section>

      <section>
        <p className="mb-2 text-xs font-medium text-muted">Color</p>
        <div className="grid grid-cols-2 gap-1.5">
          <ColorBtn
            active={colorMode === "magnitude"}
            onClick={() => setColorMode("magnitude")}
            label="Magnitude"
          />
          <ColorBtn
            active={colorMode === "heading"}
            onClick={() => setColorMode("heading")}
            label="Heading"
          />
        </div>
      </section>

      <Button variant="outline" onClick={reseed} className="w-full">
        <RotateCcw className="size-4" />
        Reseed particles
      </Button>
      <EquationControls />
    </div>
  );
}

function ColorBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ui-motion h-11 rounded-md text-sm font-medium transition-[background-color,color,box-shadow] duration-[150ms] ease-[var(--ease-out)]",
        active ? "bg-accent text-accent-fg" : "text-fg shadow-[var(--shadow-border)] hover:bg-elevated",
      )}
    >
      {label}
    </button>
  );
}

function EqInput({
  symbol,
  value,
  error,
  onChange,
}: {
  symbol: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 font-display text-lg italic text-sand">{symbol}</span>
        <span className="text-subtle">=</span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-invalid={Boolean(error)}
          aria-label={`${symbol} component`}
          className={cn(
            "h-11 font-mono",
            error && "ring-2 ring-danger/70 ring-offset-2 ring-offset-bg",
          )}
        />
      </div>
      {error ? <p className="mt-1 pl-12 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
