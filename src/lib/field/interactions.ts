/** Local 2D artistic interactions; this is not a continuum or kinetic solver. */
export type InteractingParticle = { x: number; y: number; vx: number; vy: number; species: number };
export type InteractionSpecies = {
  mass: number;
  charge: number;
  contactRadius: number; // World units; renderer radius remains in pixels.
  interactionRadius: number;
  attraction: number;
  repulsion: number;
  restitution: number;
};

/** Stable linked-cell traversal. Each candidate pair is visited once (i < j). */
export class SpatialPairs {
  private heads = new Map<string, number>();
  private next = new Int32Array(0);
  private cellX = new Int32Array(0);
  private cellY = new Int32Array(0);
  candidateChecks = 0;

  visit(particles: readonly InteractingParticle[], cellSize: number, visit: (i: number, j: number) => void) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Cell size must be positive and finite.');
    const n = particles.length;
    if (this.next.length < n) {
      this.next = new Int32Array(n);
      this.cellX = new Int32Array(n);
      this.cellY = new Int32Array(n);
    }
    this.heads.clear();
    this.candidateChecks = 0;
    for (let i = 0; i < n; i++) {
      const p = particles[i]!;
      const x = Math.floor(p.x / cellSize), y = Math.floor(p.y / cellSize);
      const key = `${x}:${y}`;
      this.cellX[i] = x; this.cellY[i] = y;
      this.next[i] = this.heads.get(key) ?? -1;
      this.heads.set(key, i);
    }
    for (let i = 0; i < n; i++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${this.cellX[i]! + dx}:${this.cellY[i]! + dy}`;
          for (let j = this.heads.get(key) ?? -1; j >= 0; j = this.next[j]!) {
            if (j <= i) continue;
            this.candidateChecks++;
            visit(i, j);
          }
        }
      }
    }
  }
}

/** Positive means attraction along the direction from particle A to B. */
export function pairForce(distance: number, a: InteractionSpecies, b: InteractionSpecies): number {
  const reach = (a.interactionRadius + b.interactionRadius) / 2;
  if (distance >= reach || distance < 0 || !Number.isFinite(distance)) return 0;
  const contact = a.contactRadius + b.contactRadius;
  if (distance < contact) return -(a.repulsion + b.repulsion) * 0.5 * (1 - distance / contact);
  const u = (distance - contact) / (reach - contact);
  const envelope = 4 * u * (1 - u);
  return Math.max(-2, Math.min(2, ((a.attraction + b.attraction) * 0.5 - 0.35 * a.charge * b.charge) * envelope));
}

/** Coincident centers get a stable normal, with no extra PRNG consumption. */
function normal(dx: number, dy: number, distance: number, i: number, j: number): [number, number] {
  if (distance > 1e-12) return [dx / distance, dy / distance];
  const angle = ((Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) >>> 0) / 4294967296 * Math.PI * 2;
  return [Math.cos(angle), Math.sin(angle)];
}

export class ParticleInteractions {
  readonly grid = new SpatialPairs();
  readonly forceX: Float64Array;
  readonly forceY: Float64Array;
  readonly reach: number;
  readonly diameter: number;

  constructor(readonlySpecies: readonly InteractionSpecies[], count: number) {
    if (!readonlySpecies.length || readonlySpecies.some(s =>
      ![s.mass, s.charge, s.contactRadius, s.interactionRadius, s.attraction, s.repulsion, s.restitution].every(Number.isFinite)
      || s.mass <= 0 || s.contactRadius <= 0 || s.interactionRadius <= s.contactRadius * 2
      || s.restitution < 0 || s.restitution > 1 || s.attraction < 0 || s.repulsion < 0
    )) throw new Error('Invalid particle interaction parameters.');
    this.forceX = new Float64Array(count);
    this.forceY = new Float64Array(count);
    this.reach = Math.max(...readonlySpecies.map(s => s.interactionRadius));
    this.diameter = 2 * Math.max(...readonlySpecies.map(s => s.contactRadius));
  }

  accumulate(particles: readonly InteractingParticle[], species: readonly InteractionSpecies[]) {
    this.forceX.fill(0); this.forceY.fill(0);
    this.grid.visit(particles, this.reach, (i, j) => {
      const a = particles[i]!, b = particles[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const strength = pairForce(distance, species[a.species]!, species[b.species]!);
      if (strength === 0) return;
      const [nx, ny] = normal(dx, dy, distance, i, j);
      // Equal and opposite forces; mass is applied by the integrator.
      this.forceX[i] += nx * strength; this.forceY[i] += ny * strength;
      this.forceX[j] -= nx * strength; this.forceY[j] -= ny * strength;
    });
  }

  resolveContacts(particles: InteractingParticle[], species: readonly InteractionSpecies[]) {
    // Two bounded sequential sweeps. Dense clusters can retain small overlaps.
    for (let pass = 0; pass < 2; pass++) {
      this.grid.visit(particles, this.diameter, (i, j) => {
        const a = particles[i]!, b = particles[j]!;
        const sa = species[a.species]!, sb = species[b.species]!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const contact = sa.contactRadius + sb.contactRadius;
        if (distance >= contact) return;
        const [nx, ny] = normal(dx, dy, distance, i, j);
        const invA = 1 / sa.mass, invB = 1 / sb.mass, invSum = invA + invB;
        const correction = Math.min(contact * 0.25, (contact - distance) * 0.8) / invSum;
        a.x -= nx * correction * invA; a.y -= ny * correction * invA;
        b.x += nx * correction * invB; b.y += ny * correction * invB;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relative >= 0) return;
        const restitution = Math.min(sa.restitution, sb.restitution);
        const impulse = -(1 + restitution) * relative / invSum;
        a.vx -= impulse * nx * invA; a.vy -= impulse * ny * invA;
        b.vx += impulse * nx * invB; b.vy += impulse * ny * invB;
      });
    }
  }
}
