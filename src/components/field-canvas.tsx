import { useEffect, useMemo, useRef } from "react";
import { compileField, type VectorField } from "@/lib/field/math";
import { useFieldStore } from "@/lib/field/store";
import { EquationSimulation } from "@/lib/field/equation";
import { useEquationStore } from "@/lib/field/equation-store";

const HIST = 16;
const BG = "#07090c";

type Particle = {
  x: number;
  y: number;
  hx: Float32Array;
  hy: Float32Array;
  n: number;
  i: number;
};

type Cam = {
  w: number;
  h: number;
  range: number;
  ox: number;
  oy: number;
  scale: number;
};

function makeCam(w: number, h: number, range: number): Cam {
  const pad = Math.min(w, h) * 0.04;
  const scale = Math.min((w - pad * 2) / (2 * range), (h - pad * 2) / (2 * range));
  return { w, h, range, ox: w / 2, oy: h / 2, scale };
}

function sx(cam: Cam, x: number) {
  return cam.ox + x * cam.scale;
}
function sy(cam: Cam, y: number) {
  return cam.oy - y * cam.scale;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function magRgb(t: number): [number, number, number] {
  const u = clamp01(t);
  const a: [number, number, number] = [22, 32, 36];
  const b: [number, number, number] = [47, 109, 108];
  const c: [number, number, number] = [212, 198, 160];
  if (u < 0.48) {
    const k = u / 0.48;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }
  const k = (u - 0.48) / 0.52;
  return [lerp(b[0], c[0], k), lerp(b[1], c[1], k), lerp(b[2], c[2], k)];
}

function headingRgb(angle: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [212, 198, 160],
    [90, 163, 154],
    [110, 168, 184],
    [122, 134, 142],
    [212, 198, 160],
  ];
  const tau = Math.PI * 2;
  const a = ((angle % tau) + tau) % tau;
  const u = a / (Math.PI / 2);
  const i = Math.floor(u) % 4;
  const f = u - Math.floor(u);
  const p = stops[i]!;
  const q = stops[i + 1]!;
  return [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)];
}

function rgb(r: number, g: number, b: number, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

function spawnParticle(range: number, rng: () => number, near?: { x: number; y: number }): Particle {
  const jitter = near ? range * 0.04 : range * 0.92;
  const x = (near?.x ?? 0) + (rng() * 2 - 1) * jitter;
  const y = (near?.y ?? 0) + (rng() * 2 - 1) * jitter;
  return {
    x,
    y,
    hx: new Float32Array(HIST),
    hy: new Float32Array(HIST),
    n: 0,
    i: 0,
  };
}

function pushHist(p: Particle) {
  const i = p.i % HIST;
  p.hx[i] = p.x;
  p.hy[i] = p.y;
  p.i += 1;
  if (p.n < HIST) p.n += 1;
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  width: number,
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1.6) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x0, y0, 1.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(7.5, len * 0.42);
  const back = len - head * 0.82;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + ux * back, y0 + uy * back);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * head + uy * head * 0.44, y1 - uy * head - ux * head * 0.44);
  ctx.lineTo(x1 - ux * head - uy * head * 0.44, y1 - uy * head + ux * head * 0.44);
  ctx.closePath();
  ctx.fill();
}

function fmt(n: number, d = 2) {
  const v = Number.isFinite(n) ? n : 0;
  const s = v.toFixed(d);
  return (v >= 0 ? " " : "") + s;
}

export function FieldCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tHud = useRef<HTMLSpanElement>(null);
  const xHud = useRef<HTMLSpanElement>(null);
  const yHud = useRef<HTMLSpanElement>(null);
  const vxHud = useRef<HTMLSpanElement>(null);
  const vyHud = useRef<HTMLSpanElement>(null);
  const magHud = useRef<HTMLSpanElement>(null);
  const angHud = useRef<HTMLSpanElement>(null);
  const hoverBox = useRef<HTMLDivElement>(null);

  const vxSrc = useFieldStore((s) => s.vxSrc);
  const vySrc = useFieldStore((s) => s.vySrc);
  const playing = useFieldStore((s) => s.playing);
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
  const seed = useFieldStore((s) => s.seed);
  const equationEnabled = useEquationStore((s) => s.enabled);

  const compiled = useMemo(() => compileField(vxSrc, vySrc), [vxSrc, vySrc]);
  const lastGood = useRef<VectorField>(compiled.field);
  if (!compiled.errorVx && !compiled.errorVy) lastGood.current = compiled.field;
  const broken = !equationEnabled && Boolean(compiled.errorVx || compiled.errorVy);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) useFieldStore.getState().setPlaying(false);

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let cam = makeCam(1, 1, range);
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let accumulator = 0;
    let equationSimulation: EquationSimulation | null = null;
    let equationKey = '';
    let maxMag = 1;
    let hover: { x: number; y: number } | null = null;
    const particles: Particle[] = [];
    const fieldRef = { current: lastGood.current };
    fieldRef.current = lastGood.current;

    const state = {
      playing,
      density,
      arrowScale,
      normalize,
      particleCount,
      speed,
      trails,
      showArrows,
      showHeat,
      colorMode,
      range,
      seed,
      broken,
    };

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.floor(cssW * dpr);
      canvas!.height = Math.floor(cssH * dpr);
      canvas!.style.width = `${cssW}px`;
      canvas!.style.height = `${cssH}px`;
      cam = makeCam(cssW, cssH, state.range);
    }

    function reseedAll(burstAt?: { x: number; y: number }) {
      const rng = mulberry32(state.seed + particles.length * 17 + 3);
      particles.length = 0;
      const n = state.particleCount;
      for (let i = 0; i < n; i += 1) {
        particles.push(spawnParticle(state.range, rng, burstAt));
      }
    }

    function syncCount() {
      const rng = mulberry32(state.seed + 99);
      while (particles.length < state.particleCount) {
        particles.push(spawnParticle(state.range, rng));
      }
      if (particles.length > state.particleCount) particles.length = state.particleCount;
    }

    function integrate(dt: number) {
      const f = fieldRef.current;
      const lim = state.range * 1.18;
      const rng = Math.random;
      const h = dt * state.speed;
      for (const p of particles) {
        const a = f(p.x, p.y, time);
        const mx = p.x + a.vx * h;
        const my = p.y + a.vy * h;
        const b = f(mx, my, time + h);
        p.x += 0.5 * (a.vx + b.vx) * h;
        p.y += 0.5 * (a.vy + b.vy) * h;
        const stalled = Math.hypot(a.vx, a.vy) < 1e-5;
        const escaped = Math.abs(p.x) > lim || Math.abs(p.y) > lim || !Number.isFinite(p.x);
        if (stalled || escaped) {
          const q = spawnParticle(state.range, rng);
          p.x = q.x;
          p.y = q.y;
          p.n = 0;
          p.i = 0;
        }
        pushHist(p);
      }
    }

    function drawHeat(ctx: CanvasRenderingContext2D, f: VectorField) {
      const n = 48;
      const cell = (2 * state.range) / n;
      const pw = cell * cam.scale + 0.6;
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          const x = -state.range + (i + 0.5) * cell;
          const y = -state.range + (j + 0.5) * cell;
          const v = f(x, y, time);
          const mag = Math.hypot(v.vx, v.vy);
          const t = mag / (maxMag || 1);
          const c =
            state.colorMode === "heading" ? headingRgb(Math.atan2(v.vy, v.vx)) : magRgb(t);
          ctx.fillStyle = rgb(c[0], c[1], c[2], 0.42);
          ctx.fillRect(sx(cam, x) - pw / 2, sy(cam, y) - pw / 2, pw, pw);
        }
      }
    }

    function drawGrid(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.lineWidth = 1;
      const step = state.range > 7 ? 2 : 1;
      ctx.strokeStyle = "rgba(236,234,228,0.05)";
      for (let x = -state.range; x <= state.range + 1e-6; x += step) {
        ctx.beginPath();
        ctx.moveTo(sx(cam, x), sy(cam, -state.range));
        ctx.lineTo(sx(cam, x), sy(cam, state.range));
        ctx.stroke();
      }
      for (let y = -state.range; y <= state.range + 1e-6; y += step) {
        ctx.beginPath();
        ctx.moveTo(sx(cam, -state.range), sy(cam, y));
        ctx.lineTo(sx(cam, state.range), sy(cam, y));
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(236,234,228,0.22)";
      ctx.beginPath();
      ctx.moveTo(sx(cam, -state.range), sy(cam, 0));
      ctx.lineTo(sx(cam, state.range), sy(cam, 0));
      ctx.moveTo(sx(cam, 0), sy(cam, -state.range));
      ctx.lineTo(sx(cam, 0), sy(cam, state.range));
      ctx.stroke();

      ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = "rgba(236,234,228,0.38)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let x = -state.range; x <= state.range + 1e-6; x += step) {
        if (Math.abs(x) < 1e-6) continue;
        ctx.fillText(String(x), sx(cam, x), sy(cam, 0) + 6);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let y = -state.range; y <= state.range + 1e-6; y += step) {
        if (Math.abs(y) < 1e-6) continue;
        ctx.fillText(String(y), sx(cam, 0) - 8, sy(cam, y));
      }
      ctx.textAlign = "left";
      ctx.fillText("0", sx(cam, 0) + 8, sy(cam, 0) + 6);
      ctx.restore();
    }

    function drawArrows(ctx: CanvasRenderingContext2D, f: VectorField) {
      const n = Math.round(state.density);
      const cell = (2 * state.range) / n;
      const maxLen = cell * 0.86 * state.arrowScale * cam.scale;
      let frameMax = 1e-6;
      const samples: { x: number; y: number; vx: number; vy: number; mag: number }[] = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          const x = -state.range + (i + 0.5) * cell;
          const y = -state.range + (j + 0.5) * cell;
          const v = f(x, y, time);
          const mag = Math.hypot(v.vx, v.vy);
          if (mag > frameMax) frameMax = mag;
          samples.push({ x, y, vx: v.vx, vy: v.vy, mag });
        }
      }
      maxMag = maxMag * 0.88 + frameMax * 0.12;
      for (const s of samples) {
        const ang = Math.atan2(s.vy, s.vx);
        const col =
          state.colorMode === "heading"
            ? headingRgb(ang)
            : magRgb(s.mag / (maxMag || 1));
        const color = rgb(col[0], col[1], col[2], 0.95);
        let len = maxLen;
        if (!state.normalize) {
          len = Math.max(4, maxLen * clamp01(s.mag / (maxMag || 1)));
        }
        if (s.mag < 1e-8) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(sx(cam, s.x), sy(cam, s.y), 1.3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const ux = s.vx / s.mag;
        const uy = s.vy / s.mag;
        const cx = sx(cam, s.x);
        const cy = sy(cam, s.y);
        drawArrow(
          ctx,
          cx - ux * len * 0.48,
          cy + uy * len * 0.48,
          cx + ux * len * 0.52,
          cy - uy * len * 0.52,
          color,
          1.35,
        );
      }
    }

    function drawParticles(ctx: CanvasRenderingContext2D) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let particleIndex = 0; particleIndex < particles.length; particleIndex++) {
        const p = particles[particleIndex]!;
        if (state.trails && p.n > 1) {
          const start = p.i - p.n;
          ctx.lineWidth = 1.2;
          for (let k = 1; k < p.n; k += 1) {
            const i0 = ((start + k - 1) % HIST + HIST) % HIST;
            const i1 = ((start + k) % HIST + HIST) % HIST;
            const a = 0.06 + (k / p.n) * 0.4;
            ctx.strokeStyle = `rgba(110,168,184,${a})`;
            ctx.beginPath();
            ctx.moveTo(sx(cam, p.hx[i0]!), sy(cam, p.hy[i0]!));
            ctx.lineTo(sx(cam, p.hx[i1]!), sy(cam, p.hy[i1]!));
            ctx.stroke();
          }
        }
        ctx.fillStyle = "#e8e4d8";
        ctx.beginPath();
        const species = equationSimulation?.program.species[particleIndex % 4];
        ctx.arc(sx(cam, p.x), sy(cam, p.y), species?.radius ?? 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawHover(ctx: CanvasRenderingContext2D, f: VectorField) {
      if (!hover) return;
      const v = f(hover.x, hover.y, time);
      const mag = Math.hypot(v.vx, v.vy);
      const px = sx(cam, hover.x);
      const py = sy(cam, hover.y);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(236,234,228,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(cam, -state.range), py);
      ctx.lineTo(sx(cam, state.range), py);
      ctx.moveTo(px, sy(cam, -state.range));
      ctx.lineTo(px, sy(cam, state.range));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#eceae4";
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      const len = Math.min(cam.scale * 1.15, 72);
      if (mag > 1e-8) {
        const ux = v.vx / mag;
        const uy = v.vy / mag;
        drawArrow(ctx, px, py, px + ux * len, py - uy * len, "#eceae4", 1.8);
        ctx.strokeStyle = "rgba(110,168,184,0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + ux * len, py);
        ctx.lineTo(px + ux * len, py - uy * len);
        ctx.stroke();
      }
      ctx.restore();

      if (xHud.current) xHud.current.textContent = fmt(hover.x);
      if (yHud.current) yHud.current.textContent = fmt(hover.y);
      if (vxHud.current) vxHud.current.textContent = fmt(v.vx);
      if (vyHud.current) vyHud.current.textContent = fmt(v.vy);
      if (magHud.current) magHud.current.textContent = fmt(mag);
      if (angHud.current) {
        const deg = (Math.atan2(v.vy, v.vx) * 180) / Math.PI;
        angHud.current.textContent = `${fmt(deg, 1)}°`;
      }
    }

    function paint() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cssW, cssH);

      const f = fieldRef.current;
      if (state.showHeat) drawHeat(ctx, f);
      drawGrid(ctx);
      if (state.showArrows) drawArrows(ctx, f);
      drawParticles(ctx);

      const g = ctx.createRadialGradient(cam.ox, cam.oy, cam.scale * state.range * 0.35, cam.ox, cam.oy, cam.scale * state.range * 1.2);
      g.addColorStop(0, "rgba(7,9,12,0)");
      g.addColorStop(1, "rgba(7,9,12,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);

      drawHover(ctx, f);

      if (tHud.current) tHud.current.textContent = time.toFixed(2);
      if (hoverBox.current) hoverBox.current.dataset.on = hover ? "1" : "0";
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const equation = useEquationStore.getState();
      if (equation.enabled) {
        const key = `${equation.revision}:${state.range}:${state.particleCount}:${state.seed}`;
        if (!equationSimulation || key !== equationKey) {
          equationKey = key;
          equationSimulation = new EquationSimulation(equation.program, state.range, state.particleCount);
          accumulator = 0;
          time = 0;
          maxMag = 1;
          const rng = mulberry32(equation.program.seed);
          particles.length = 0;
          for (const p of equationSimulation.particles) particles.push({...spawnParticle(state.range,rng),x:p.x,y:p.y});
        }
        fieldRef.current = equation.program.field;
        if (state.playing) {
          accumulator += dt * state.speed;
          while (accumulator >= 1/120) {
            equationSimulation.step();
            equationSimulation.particles.forEach((p,i) => { const trail=particles[i]!; trail.x=p.x; trail.y=p.y; pushHist(trail); });
            accumulator -= 1/120;
          }
        }
        time = equationSimulation.time;
      } else {
        if (equationSimulation) { equationSimulation = null; time = 0; reseedAll(); }
        fieldRef.current = lastGood.current;
      }
      if (state.playing && !equation.enabled) {
        time += dt * Math.max(0.15, state.speed);
        integrate(dt);
      }
      paint();
      raf = requestAnimationFrame(loop);
    }

    function pointerToWorld(ev: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      return {
        x: (px - cam.ox) / cam.scale,
        y: (cam.oy - py) / cam.scale,
      };
    }

    function onMove(ev: PointerEvent) {
      hover = pointerToWorld(ev);
    }
    function onLeave() {
      hover = null;
    }
    function onDown(ev: PointerEvent) {
      const wpt = pointerToWorld(ev);
      if (equationSimulation) {
        equationSimulation.inject(wpt);
        equationSimulation.particles.forEach((p,i) => {const trail=particles[i]!;trail.x=p.x;trail.y=p.y;if(i<18){trail.n=0;trail.i=0;}});
        return;
      }
      const rng = Math.random;
      for (let i = 0; i < 18; i += 1) {
        const p = spawnParticle(state.range, rng, wpt);
        if (particles.length >= state.particleCount) {
          particles[i % particles.length] = p;
        } else {
          particles.push(p);
        }
      }
    }

    resize();
    reseedAll();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    raf = requestAnimationFrame(loop);

    const unsub = useFieldStore.subscribe((s) => {
      const seedChanged = s.seed !== state.seed;
      const rangeChanged = s.range !== state.range;
      state.playing = s.playing;
      state.density = s.density;
      state.arrowScale = s.arrowScale;
      state.normalize = s.normalize;
      state.particleCount = s.particleCount;
      state.speed = s.speed;
      state.trails = s.trails;
      state.showArrows = s.showArrows;
      state.showHeat = s.showHeat;
      state.colorMode = s.colorMode;
      state.range = s.range;
      state.seed = s.seed;
      cam = makeCam(cssW, cssH, state.range);
      if (seedChanged || rangeChanged) reseedAll();
      else syncCount();
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!compiled.errorVx && !compiled.errorVy) {
      lastGood.current = compiled.field;
    }
  }, [compiled]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-bg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none cursor-crosshair"
        aria-label="Vector field plot"
      />
      <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-bg/70 px-3 py-2 shadow-[var(--shadow-border)]">
        <p className="font-mono text-xs tabular-nums text-muted">
          t = <span ref={tHud} className="text-fg">0.00</span>
        </p>
        <div
          ref={hoverBox}
          data-on="0"
          className="mt-1 hidden grid-cols-[1.4rem_1fr] gap-x-2 gap-y-0.5 font-mono text-xs tabular-nums data-[on=1]:grid"
        >
          <span className="text-subtle">x</span>
          <span ref={xHud} className="text-fg">
            0.00
          </span>
          <span className="text-subtle">y</span>
          <span ref={yHud} className="text-fg">
            0.00
          </span>
          <span className="text-subtle">Vx</span>
          <span ref={vxHud} className="text-fg">
            0.00
          </span>
          <span className="text-subtle">Vy</span>
          <span ref={vyHud} className="text-fg">
            0.00
          </span>
          <span className="text-subtle">|V|</span>
          <span ref={magHud} className="text-sand">
            0.00
          </span>
          <span className="text-subtle">θ</span>
          <span ref={angHud} className="text-fg">
            0.0°
          </span>
        </div>
      </div>
      <p className="pointer-events-none absolute right-3 bottom-3 hidden font-mono text-xs text-subtle sm:block">
        hover to read · click to seed
      </p>
      {broken ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-xs text-danger">
          Last valid field is shown
        </p>
      ) : null}
    </div>
  );
}
