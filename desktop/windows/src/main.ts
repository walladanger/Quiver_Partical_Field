import { compileEquation, EQUATION_PRESETS, type EquationProgram } from '../../../src/lib/field/equation.ts';
import { EquationSimulation3D, type Particle3D } from '../../../src/lib/field/dynamics-3d.ts';
import './style.css';

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>('#field');
const ctx = canvas.getContext('2d')!;
const form = $<HTMLFormElement>('#equation-form');
const equationInput = $<HTMLInputElement>('#equation');
const presetSelect = $<HTMLSelectElement>('#presets');
const countInput = $<HTMLSelectElement>('#count');
const playButton = $<HTMLButtonElement>('#play');
const status = $('#status');
const colors = ['#d4c6a0', '#5aa39a', '#6ea8b8', '#a8a4d0'];
const trailLength = 9;

for (const preset of EQUATION_PRESETS) {
  const option = document.createElement('option');
  option.value = preset.equation;
  option.textContent = preset.name;
  presetSelect.append(option);
}

let program: EquationProgram;
let simulation: EquationSimulation3D;
let variation = 0;
let playing = true;
let trailsEnabled = true;
let trails: { x: number; y: number; z: number }[][] = [];
let width = 1, height = 1, dpr = 1;
let yaw = 0.58, pitch = 0.35, zoom = 2.9;
let target = { x: 0, y: 0, z: 0 };
let last = performance.now(), accumulated = 0;
let pointers = new Map<number, { x: number; y: number }>();

function resetSimulation() {
  program = compileEquation(equationInput.value, variation);
  simulation = new EquationSimulation3D(program, 4, Number(countInput.value));
  trails = simulation.particles.map(() => []);
  accumulated = 0;
  status.textContent = `${program.interpretation} · ${program.fingerprint.slice(0, 12)} · variation ${variation}`;
  $('#complexity').textContent = String(program.complexity);
}

function resize() {
  const box = canvas.getBoundingClientRect();
  width = Math.max(1, box.width); height = Math.max(1, box.height);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
}
new ResizeObserver(resize).observe(canvas);
resize();

function project(point: { x: number; y: number; z: number }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const px = point.x - target.x, py = point.y - target.y, pz = point.z - target.z;
  const x = cy * px - sy * pz;
  const z = sy * px + cy * pz;
  const y = cp * py - sp * z;
  const depth = sp * py + cp * z;
  const distance = 4 * zoom;
  const scale = Math.min(width, height) * 0.46 / 4 * (2.9 / zoom) * distance / Math.max(3.2, distance - depth);
  return { x: width / 2 + x * scale, y: height / 2 - y * scale, depth, scale };
}

function line(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, color: string) {
  const pa = project(a), pb = project(b);
  ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, width, height);
  const r = 4;
  ctx.lineWidth = 1;
  for (const z of [-r, r]) for (const x of [-r, r]) line({ x, y: -r, z }, { x, y: r, z }, 'rgba(236,234,228,.12)');
  for (const y of [-r, r]) for (const x of [-r, r]) line({ x, y, z: -r }, { x, y, z: r }, 'rgba(236,234,228,.12)');
  for (const y of [-r, r]) for (const z of [-r, r]) line({ x: -r, y, z }, { x: r, y, z }, 'rgba(236,234,228,.12)');
  for (let n = -2; n <= 2; n++) {
    const v = n * r / 2;
    line({ x: -r, y: -r, z: v }, { x: r, y: -r, z: v }, 'rgba(236,234,228,.045)');
    line({ x: v, y: -r, z: -r }, { x: v, y: -r, z: r }, 'rgba(236,234,228,.045)');
  }
  line({ x: -r, y: 0, z: 0 }, { x: r, y: 0, z: 0 }, 'rgba(212,198,160,.46)');
  line({ x: 0, y: -r, z: 0 }, { x: 0, y: r, z: 0 }, 'rgba(90,163,154,.46)');
  line({ x: 0, y: 0, z: -r }, { x: 0, y: 0, z: r }, 'rgba(110,168,184,.46)');
  const ordered = simulation.particles.map((p, i) => ({ p, i, screen: project(p) })).sort((a, b) => a.screen.depth - b.screen.depth);
  for (const { p, i, screen } of ordered) {
    const color = colors[p.species % colors.length]!;
    if (trailsEnabled && trails[i]!.length > 1) {
      ctx.strokeStyle = color; ctx.globalAlpha = .3; ctx.lineWidth = Math.max(.6, Math.min(2, screen.scale / 25)); ctx.beginPath();
      trails[i]!.forEach((pt, j) => { const v = project(pt); if (j === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = Math.max(.4, Math.min(1, .8 + screen.depth / 20)); ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(screen.x, screen.y, Math.max(1, Math.min(6, screen.scale / 14)), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  $('#clock').textContent = simulation.time.toFixed(2);
  $('#particle-total').textContent = String(simulation.particles.length);
}

function frame(now: number) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (playing) {
    accumulated = Math.min(.12, accumulated + dt);
    let steps = 0;
    while (accumulated >= simulation.timestep && steps++ < 6) {
      simulation.step(); accumulated -= simulation.timestep;
      if (trailsEnabled) simulation.particles.forEach((p, i) => {
        const trail = trails[i]!; trail.push({ x: p.x, y: p.y, z: p.z });
        if (trail.length > trailLength) trail.shift();
      });
    }
    if (steps > 6) accumulated = 0;
  }
  render();
  requestAnimationFrame(frame);
}

form.addEventListener('submit', (event) => { event.preventDefault(); resetSimulation(); });
presetSelect.addEventListener('change', () => { equationInput.value = presetSelect.value; resetSimulation(); });
countInput.addEventListener('change', resetSimulation);
playButton.addEventListener('click', () => {
  playing = !playing; playButton.textContent = playing ? 'Pause' : 'Play'; playButton.setAttribute('aria-pressed', String(playing));
});
$('#reroll').addEventListener('click', () => { variation++; $('#variation').textContent = String(variation); resetSimulation(); });
$('#restart').addEventListener('click', () => { variation = 0; $('#variation').textContent = '0'; resetSimulation(); });
$('#trails').addEventListener('change', (event) => {
  trailsEnabled = (event.currentTarget as HTMLInputElement).checked;
  if (!trailsEnabled) trails.forEach((trail) => { trail.length = 0; });
});
$('#fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen();
});
$('#reset-camera').addEventListener('click', () => { yaw = .58; pitch = .35; zoom = 2.9; target = { x: 0, y: 0, z: 0 }; });

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
});
canvas.addEventListener('pointermove', (event) => {
  const prev = pointers.get(event.pointerId); if (!prev) return;
  const dx = event.clientX - prev.x, dy = event.clientY - prev.y;
  if (pointers.size === 1 && !(event.buttons & 2) && !event.shiftKey) {
    yaw += dx * .008; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * .008));
  } else if (pointers.size === 1) {
    const scale = 4 * zoom / (Math.min(width, height) * .46 * 2.9);
    const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
    const up = { x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch) };
    target = { x: target.x - dx * scale * right.x + dy * scale * up.x, y: target.y - dx * scale * right.y + dy * scale * up.y, z: target.z - dx * scale * right.z + dy * scale * up.z };
  } else {
    const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const oldD = Math.hypot(prev.x - other.x, prev.y - other.y), newD = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (newD > 1 && oldD > 1) zoom = Math.max(1.4, Math.min(8, zoom * oldD / newD));
    }
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
});
const releasePointer = (event: PointerEvent) => pointers.delete(event.pointerId);
canvas.addEventListener('pointerup', releasePointer); canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('wheel', (event) => { event.preventDefault(); zoom = Math.max(1.4, Math.min(8, zoom * Math.exp(event.deltaY * .001))); }, { passive: false });

equationInput.value = EQUATION_PRESETS[0].equation;
presetSelect.value = equationInput.value;
resetSimulation();
requestAnimationFrame(frame);
