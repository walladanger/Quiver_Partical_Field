import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EQUATION_PRESETS } from '@/lib/field/equation';
import { useEquationStore } from '@/lib/field/equation-store';

export function EquationControls() {
  const {enabled,program,apply,setEnabled,reset} = useEquationStore();
  const [source,setSource] = useState(program.source);
  const [variation,setVariation] = useState(String(program.variation));
  const validVariation = /^\d+$/.test(variation) && Number.isSafeInteger(Number(variation));
  return <details className="rounded-md border border-border p-3">
    <summary className="cursor-pointer text-sm font-medium text-fg">Equation dynamics</summary>
    <div className="mt-3 flex flex-col gap-3">
      <label className="flex min-h-11 items-center justify-between gap-2 text-sm">
        Enable equation mode <Switch checked={enabled} onCheckedChange={setEnabled} />
      </label>
      <p className="text-xs text-muted">Equation-driven particle dynamics. Physics equations are visual interpretations.</p>
      <label className="text-xs text-muted">Equation preset
        <select aria-label="Equation preset" defaultValue="" className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-2 text-fg"
          onChange={e => {if (e.target.value) setSource(e.target.value);}}>
          <option value="" disabled>Choose an example</option>
          {EQUATION_PRESETS.map(p => <option key={p.name} value={p.equation}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">Equation
        <textarea aria-label="Dynamics equation" value={source} onChange={e => setSource(e.target.value)} maxLength={4096} rows={3}
          className="mt-1 w-full resize-y rounded-md border border-border bg-bg p-2 font-mono text-sm text-fg" spellCheck={false} />
      </label>
      <label className="text-xs text-muted">Variation
        <Input aria-label="Equation variation" inputMode="numeric" value={variation} onChange={e => setVariation(e.target.value)} aria-invalid={!validVariation} className="mt-1 h-11" />
      </label>
      <Button disabled={!source.trim() || !validVariation} onClick={() => apply(source,Number(variation))}>Apply equation</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={reset}>Reset equation</Button>
        <Button variant="outline" onClick={() => {const next = program.variation >= Number.MAX_SAFE_INTEGER ? 0 : program.variation+1;setVariation(String(next));setSource(program.source);apply(program.source,next);}}>Next variation</Button>
      </div>
      <div role="status" className="break-words text-xs leading-relaxed text-muted">
        <p>{program.interpretation}</p>
        {program.diagnostic && <p>{program.diagnostic}</p>}
        <p>Residual: {program.features.residual ?? 'not numerically evaluated'} · Augmentation: {Math.round(program.augmentation*100)}%</p>
        <p>4 species · Variation {program.variation} · Seed {program.seed}</p>
        <p>Same equation and variation replay the same initial universe.</p>
      </div>
    </div>
  </details>;
}
