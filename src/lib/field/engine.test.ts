import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createGraphicsEngine } from './engine.ts';

test('3D wrapper advances reproducibly with finite positions, species and a real z axis', () => {
  const options = {equation:'1+1+1=2',dimensions:3 as const,particleCount:80};
  const a = createGraphicsEngine(options), b = createGraphicsEngine(options);
  const before = structuredClone(a.particles);
  assert.ok(before.some(p => 'z' in p && typeof p.z === 'number' && Math.abs(p.z) > 0.01));
  a.step(120); b.step(120);
  assert.deepEqual(a.particles,b.particles);
  assert.ok(a.particles.some((p,i) => JSON.stringify(p) !== JSON.stringify(before[i])));
  for(const p of a.particles) for(const n of Object.values(p)) assert.ok(typeof n === 'number' && Number.isFinite(n));
  assert.ok(Math.abs(a.time-1) < 1e-12);
  assert.notDeepEqual(createGraphicsEngine({...options,variation:1}).particles,before);
});

test('typed wrapper preserves existing 2D simulation and bounds input', () => {
  const sim = createGraphicsEngine({equation:'x+y',dimensions:2,particleCount:5});
  assert.equal(sim.particles.length,5);
  assert.ok(sim.particles.every(p => !('z' in p)));
  assert.throws(() => sim.step(-1), /Invalid step count/);
});
