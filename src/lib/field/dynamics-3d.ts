/** Deterministic 3D equation-driven particles. The existing planar solver remains independent. */
import { pairForce } from './interactions.ts';
import { randomFromSeed, type EquationProgram } from './equation.ts';

export type Particle3D = { x: number; y: number; z: number; vx: number; vy: number; vz: number; species: number };
const STEP = 1 / 120;
const limit = (v: number, n: number) => Math.max(-n, Math.min(n, Number.isFinite(v) ? v : 0));

export class EquationSimulation3D {
  readonly program: EquationProgram;
  readonly range: number;
  readonly particles: Particle3D[] = [];
  readonly timestep = STEP;
  time = 0;
  private readonly rng: () => number;
  private readonly reach: number;
  private readonly fx: Float64Array;
  private readonly fy: Float64Array;
  private readonly fz: Float64Array;
  private readonly cells = new Map<string, number[]>();

  constructor(program: EquationProgram, range: number, count: number) {
    if (!Number.isFinite(range) || range <= 0 || !Number.isInteger(count) || count < 0 || count > 5000)
      throw new Error('Invalid 3D simulation bounds.');
    this.program = program; this.range = range;
    this.rng = randomFromSeed(program.seed);
    this.reach = Math.max(...program.species.map(s => s.interactionRadius));
    this.fx = new Float64Array(count); this.fy = new Float64Array(count); this.fz = new Float64Array(count);
    for (let i = 0; i < count; i++) this.particles.push(this.spawn(i % program.species.length));
  }

  private spawn(species: number, near?: { x: number; y: number; z: number }): Particle3D {
    const radius = this.range * (near ? 0.04 : 0.8);
    return { x: limit((near?.x ?? 0) + (this.rng() * 2 - 1) * radius, this.range),
      y: limit((near?.y ?? 0) + (this.rng() * 2 - 1) * radius, this.range),
      z: limit((near?.z ?? 0) + (this.rng() * 2 - 1) * radius, this.range),
      vx: 0, vy: 0, vz: 0, species };
  }

  inject(near: { x: number; y: number; z: number }) {
    for (let i = 0; i < Math.min(18, this.particles.length); i++)
      this.particles[i] = this.spawn(i % this.program.species.length, near);
  }

  step() {
    this.fx.fill(0); this.fy.fill(0); this.fz.fill(0); this.cells.clear();
    const cell = (x: number, y: number, z: number) => `${x}:${y}:${z}`;
    const coords = this.particles.map(p => [Math.floor(p.x / this.reach), Math.floor(p.y / this.reach), Math.floor(p.z / this.reach)]);
    for (let i = 0; i < coords.length; i++) {
      const [x, y, z] = coords[i]!;
      const key = cell(x!, y!, z!);
      const bucket = this.cells.get(key) ?? [];
      bucket.push(i); this.cells.set(key, bucket);
    }
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i]!, [cx, cy, cz] = coords[i]!;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of this.cells.get(cell(cx! + dx, cy! + dy, cz! + dz)) ?? []) {
          if (j <= i) continue;
          const b = this.particles[j]!;
          const px = b.x - a.x, py = b.y - a.y, pz = b.z - a.z;
          const dist = Math.hypot(px, py, pz);
          const sa = this.program.species[a.species]!, sb = this.program.species[b.species]!;
          const strength = pairForce(dist, sa, sb);
          if (strength === 0) continue;
          // A stable fallback separates coincident particles without consuming randomness.
          const angle = ((Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) >>> 0) / 4294967296 * Math.PI * 2;
          const nx = dist > 1e-12 ? px / dist : Math.cos(angle);
          const ny = dist > 1e-12 ? py / dist : Math.sin(angle);
          const nz = dist > 1e-12 ? pz / dist : 0;
          this.fx[i] += nx * strength; this.fy[i] += ny * strength; this.fz[i] += nz * strength;
          this.fx[j] -= nx * strength; this.fy[j] -= ny * strength; this.fz[j] -= nz * strength;
          const contact = sa.contactRadius + sb.contactRadius;
          if (dist < contact) {
            const ia = 1 / sa.mass, ib = 1 / sb.mass;
            const correction = Math.min(contact * 0.25, (contact - dist) * 0.8) / (ia + ib);
            a.x -= nx * correction * ia; a.y -= ny * correction * ia; a.z -= nz * correction * ia;
            b.x += nx * correction * ib; b.y += ny * correction * ib; b.z += nz * correction * ib;
            const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
            if (relative < 0) {
              const impulse = -(1 + (sa.restitution + sb.restitution) / 2) * relative / (ia + ib);
              a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia; a.vz -= impulse * nz * ia;
              b.vx += impulse * nx * ib; b.vy += impulse * ny * ib; b.vz += impulse * nz * ib;
            }
          }
        }
      }
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!, s = this.program.species[p.species]!;
      const xy = this.program.field(p.x, p.y, this.time);
      const yz = this.program.field(p.y, p.z, this.time + this.program.controls[42]!);
      const zx = this.program.field(p.z, p.x, this.time + this.program.controls[43]!);
      const drag = Math.exp(-s.drag * STEP), jitter = s.noise * Math.sqrt(STEP);
      p.vx = limit((p.vx + (xy.vx + zx.vy * 0.35 + this.fx[i]!) * STEP / s.mass) * drag + (this.rng() * 2 - 1) * jitter, 4);
      p.vy = limit((p.vy + (xy.vy + yz.vx * 0.35 + this.fy[i]!) * STEP / s.mass) * drag + (this.rng() * 2 - 1) * jitter, 4);
      p.vz = limit((p.vz + (yz.vy + zx.vx * 0.35 + this.fz[i]!) * STEP / s.mass) * drag + (this.rng() * 2 - 1) * jitter, 4);
      p.x += p.vx * STEP; p.y += p.vy * STEP; p.z += p.vz * STEP;
      for (const [axis, velocity] of [['x', 'vx'], ['y', 'vy'], ['z', 'vz']] as const) {
        if (Math.abs(p[axis]) > this.range) { p[axis] = limit(p[axis], this.range); p[velocity] *= -0.8; }
      }
    }
    this.time += STEP;
  }
}
