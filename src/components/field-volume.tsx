import { useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCcw, Crosshair } from 'lucide-react';
import { EquationSimulation3D } from '@/lib/field/dynamics-3d';
import { createGraphicsEngine } from '@/lib/field/engine';
import { useEquationStore } from '@/lib/field/equation-store';
import { useFieldStore } from '@/lib/field/store';

type Point = { x: number; y: number; z: number };
const COLORS = ['#d4c6a0', '#5aa39a', '#6ea8b8', '#a8a4d0'];
const HISTORY = 10;

export function FieldVolume() {
  const [injection, setInjection] = useState<Point>({x: 0, y: 0, z: 0});
  const injectionRef = useRef(injection);
  const injectRef = useRef<(() => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = host.current, canvas = canvasRef.current;
    if (!node || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 1, h = 1, dpr = 1, raf = 0, last = performance.now(), accumulated = 0;
    let yaw = 0.58, pitch = 0.35, zoom = 2.9;
    let target: Point = {x: 0, y: 0, z: 0};
    let simulation: EquationSimulation3D | null = null, key = '';
    let history: Point[][] = [];
    const pointers = new Map<number, { x: number; y: number }>();
    resetCameraRef.current = () => {yaw = 0.58; pitch = 0.35; zoom = 2.9; target = {x: 0, y: 0, z: 0};};
    injectRef.current = () => {
      if (!simulation) return;
      simulation.inject(injectionRef.current);
      history.slice(0, 18).forEach(trail => {trail.length = 0;});
    };

    const resize = () => {
      const r = node.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); resize();

    function project(p: Point, range: number) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const px = p.x - target.x, py = p.y - target.y, pz = p.z - target.z;
      const x = cy * px - sy * pz;
      const z = sy * px + cy * pz;
      const y = cp * py - sp * z;
      const depth = sp * py + cp * z;
      const distance = range * zoom;
      const scale = Math.min(w, h) * 0.46 / range * (2.9 / zoom) * distance / Math.max(range * 0.8, distance - depth);
      return { x: w / 2 + x * scale, y: h / 2 - y * scale, depth, scale };
    }
    function line(a: Point, b: Point, range: number, color: string) {
      const pa = project(a, range), pb = project(b, range);
      ctx!.strokeStyle = color; ctx!.beginPath();
      ctx!.moveTo(pa.x, pa.y); ctx!.lineTo(pb.x, pb.y); ctx!.stroke();
    }
    function render(sim: EquationSimulation3D, showTrails: boolean) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = '#07090c'; ctx!.fillRect(0, 0, w, h);
      const r = sim.range;
      ctx!.lineWidth = 1;
      for (const z of [-r, r]) for (const x of [-r, r]) line({x,y:-r,z},{x,y:r,z},r,'rgba(236,234,228,0.12)');
      for (const y of [-r, r]) for (const x of [-r, r]) line({x,y,z:-r},{x,y,z:r},r,'rgba(236,234,228,0.12)');
      for (const y of [-r, r]) for (const z of [-r, r]) line({x:-r,y,z},{x:r,y,z},r,'rgba(236,234,228,0.12)');
      for (let n = -2; n <= 2; n++) {
        const v = n * r / 2;
        line({x:-r,y:-r,z:v},{x:r,y:-r,z:v},r,'rgba(236,234,228,0.045)');
        line({x:v,y:-r,z:-r},{x:v,y:-r,z:r},r,'rgba(236,234,228,0.045)');
      }
      line({x:-r,y:0,z:0},{x:r,y:0,z:0},r,'rgba(212,198,160,0.46)');
      line({x:0,y:-r,z:0},{x:0,y:r,z:0},r,'rgba(90,163,154,0.46)');
      line({x:0,y:0,z:-r},{x:0,y:0,z:r},r,'rgba(110,168,184,0.46)');
      const ordered = sim.particles.map((p, i) => ({p,i,screen:project(p,r)})).sort((a,b) => a.screen.depth - b.screen.depth);
      for (const {p,i,screen} of ordered) {
        const species = sim.program.species[p.species]!;
        ctx!.strokeStyle = COLORS[p.species % COLORS.length]!;
        if (showTrails && history[i]!.length > 1) {
          ctx!.globalAlpha = 0.3; ctx!.lineWidth = Math.max(0.6, Math.min(2, species.radius * screen.scale / 25));
          ctx!.beginPath();
          history[i]!.forEach((pt,j) => {const v=project(pt,r); if(j===0)ctx!.moveTo(v.x,v.y);else ctx!.lineTo(v.x,v.y);});
          ctx!.stroke(); ctx!.globalAlpha = 1;
        }
        const radius = Math.max(1, Math.min(6, species.radius * screen.scale / 14));
        ctx!.globalAlpha = Math.max(0.4, Math.min(1, 0.8 + screen.depth / (r * 5)));
        ctx!.fillStyle = COLORS[p.species % COLORS.length]!;
        ctx!.beginPath(); ctx!.arc(screen.x, screen.y, radius, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const field = useFieldStore.getState(), equation = useEquationStore.getState();
      const nextKey = `${equation.revision}:${field.range}:${field.particleCount}:${field.seed}`;
      if (!simulation || nextKey !== key) {
        key = nextKey;
        simulation = createGraphicsEngine({equation: equation.program.source,variation: equation.program.variation,dimensions:3,range:field.range,particleCount:field.particleCount}).simulation as EquationSimulation3D;
        history = simulation.particles.map(() => []); accumulated = 0;
      }
      if (field.playing) {
        accumulated = Math.min(0.12, accumulated + dt * field.speed);
        let steps = 0;
        while (accumulated >= simulation.timestep && steps++ < 6) {
          simulation.step(); accumulated -= simulation.timestep;
          if (field.trails) simulation.particles.forEach((p,i) => {
            const trail = history[i]!; trail.push({x:p.x,y:p.y,z:p.z});
            if (trail.length > HISTORY) trail.shift();
          });
        }
        if (steps > 6) accumulated = 0;
      }
      if (!field.trails) history.forEach(trail => {trail.length = 0;});
      render(simulation, field.trails);
      if (clock.current) clock.current.textContent = simulation.time.toFixed(2);
      raf = requestAnimationFrame(frame);
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    };
    const onMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      if (pointers.size === 1 && !(event.buttons & 2) && !event.shiftKey) {
        yaw += dx * 0.008; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * 0.008));
      } else if (pointers.size === 1) {
        const scale = (simulation?.range ?? 4) * zoom / (Math.min(w, h) * 0.46 * 2.9);
        const right = {x: Math.cos(yaw), y: 0, z: -Math.sin(yaw)};
        const up = {x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch)};
        target = {x: target.x - dx * scale * right.x + dy * scale * up.x,
          y: target.y - dx * scale * right.y + dy * scale * up.y,
          z: target.z - dx * scale * right.z + dy * scale * up.z};
      } else {
        const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
        if (other) {
          const oldDistance = Math.hypot(previous.x-other.x, previous.y-other.y);
          const newDistance = Math.hypot(event.clientX-other.x, event.clientY-other.y);
          if (newDistance > 1 && oldDistance > 1) zoom = Math.max(1.4,Math.min(8,zoom * oldDistance/newDistance));
        }
      }
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onWheel = (event: WheelEvent) => {event.preventDefault(); zoom = Math.max(1.4, Math.min(8, zoom * Math.exp(event.deltaY * 0.001)));};
    canvas.addEventListener('pointerdown',onDown); canvas.addEventListener('pointermove',onMove);
    canvas.addEventListener('pointerup',onUp); canvas.addEventListener('pointercancel',onUp);
    canvas.addEventListener('wheel',onWheel,{passive:false});
    canvas.addEventListener('contextmenu',onContextMenu);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect();
      canvas.removeEventListener('pointerdown',onDown); canvas.removeEventListener('pointermove',onMove);
      canvas.removeEventListener('pointerup',onUp); canvas.removeEventListener('pointercancel',onUp);
      canvas.removeEventListener('wheel',onWheel); canvas.removeEventListener('contextmenu',onContextMenu);
      injectRef.current = null; resetCameraRef.current = null; };
  }, []);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void host.current?.requestFullscreen();
  };
  return <div ref={host} className="relative size-full overflow-hidden bg-bg">
    <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none cursor-grab active:cursor-grabbing" aria-label="Interactive 3D equation particle field" />
    <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-bg/80 px-3 py-2 font-mono text-xs text-muted shadow-[var(--shadow-border)]">3D equation universe · t = <span ref={clock} className="text-fg">0.00</span><br />Drag to orbit · right drag or shift drag to pan · scroll or pinch to zoom</div>
    <div className="absolute top-3 right-3 flex gap-2">
      <button type="button" onClick={() => resetCameraRef.current?.()} title="Reset camera" aria-label="Reset camera" className="flex size-11 items-center justify-center rounded-md border border-border bg-bg text-fg"><Crosshair className="size-4" /></button>
      <button type="button" onClick={() => useFieldStore.getState().reseed()} title="Restart 3D simulation" aria-label="Restart 3D simulation" className="flex size-11 items-center justify-center rounded-md border border-border bg-bg text-fg"><RotateCcw className="size-4" /></button>
      <button type="button" onClick={fullscreen} title="Toggle fullscreen" aria-label="Toggle fullscreen" className="flex size-11 items-center justify-center rounded-md border border-border bg-bg text-fg"><Maximize2 className="size-4" /></button>
    </div>
    <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-end gap-2 rounded-lg bg-bg/90 p-2 text-xs text-fg shadow-[var(--shadow-border)]">
      {(['x','y','z'] as const).map(axis => <label key={axis} className="flex flex-col gap-1 uppercase">{axis}<input type="number" step="0.1" value={injection[axis]} onChange={event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        const next = {...injectionRef.current, [axis]: value}; injectionRef.current = next; setInjection(next);
      }} className="w-16 rounded border border-border bg-bg px-2 py-1 text-fg" /></label>)}
      <button type="button" onClick={() => injectRef.current?.()} className="min-h-9 rounded border border-border bg-bg px-3 text-fg">Inject at XYZ</button>
    </div>
  </div>;
}
