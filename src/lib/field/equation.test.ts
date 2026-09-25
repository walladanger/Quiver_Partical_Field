import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileEquation, parseEquation, sha256, EquationSimulation, EQUATION_PRESETS } from './equation.ts';
import { compileExpr, compileField } from './math.ts';
import { SpatialPairs, ParticleInteractions, pairForce, type InteractionSpecies, type InteractingParticle } from './interactions.ts';

test('SHA-256 matches standard implementation for ASCII, Unicode and multiblock inputs', () => {
  for (const s of ['', 'abc', '∇²ψ = ρ', 'x'.repeat(4096)]) assert.equal(sha256(s),createHash('sha256').update(s).digest('hex'));
});
test('false and balanced equalities retain a signed residual', () => {
  assert.equal(compileEquation('1+1+1=2').features.residual,1);
  assert.equal(compileEquation('1+1=2').features.residual,0);
  assert.equal(compileEquation('1=2').features.residual,-1);
  assert.equal(compileEquation('x+1=2').features.residual,null);
  assert.equal(compileEquation('1/0=2').features.residual,null);
});
test('parser handles precedence, right associative powers, unary and implicit multiplication', () => {
  for (const equation of ['2^3^2=512','-2^2=-4','2^-2=0.25','2(3+1)=8','sin(pi/2)=1']) assert.equal(compileEquation(equation).features.residual,0,equation);
  assert.notDeepEqual(parseEquation('x y'),parseEquation('xy'));
});
test('canonical structure ignores presentation and variation changes the generated universe', () => {
  const a=compileEquation('1 + 1 + 1 = 2');
  const b=compileEquation('(1+1)+1=2');
  assert.equal(a.fingerprint,b.fingerprint);
  assert.notEqual(a.fingerprint,compileEquation(a.source,3).fingerprint);
  assert.equal(a.source,'1 + 1 + 1 = 2');
  assert.equal(compileEquation('1+1').augmentation > compileEquation('sin(x)+cos(y)+t^2+x*y').augmentation,true);
});
test('malformed notation, named equations, limits and malicious strings have bounded fallback', () => {
  for (const source of ['', '(', ')', 'x==y', 'globalThis.process.exit()', '<script>alert(1)</script>', 'sin()', 'sin(1,2)', '('.repeat(200)+'1'+')'.repeat(200), 'x'.repeat(8000), ...EQUATION_PRESETS.map(p=>p.equation)]) {
    const p=compileEquation(source);
    assert.equal(p.controls.length,64);
    assert.ok(p.controls.every(Number.isFinite));
    for (const x of [-1e12,0,2,Infinity,NaN]) { const f=p.field(x,2,3); assert.ok(Number.isFinite(f.vx)&&Number.isFinite(f.vy));assert.ok(Math.abs(f.vx)<=8&&Math.abs(f.vy)<=8); }
  }
  assert.equal(compileEquation('Navier-Stokes').mode,'equation-driven');
});
test('fixed-step simulation, boundaries, injections and reset replay deterministically', () => {
  const p=compileEquation('1+1+1=2',17);
  const a=new EquationSimulation(p,1.5,60), b=new EquationSimulation(p,1.5,60);
  const initial=structuredClone(a.particles);
  for(let i=0;i<1200;i++){ if(i===120){a.inject({x:1,y:0});b.inject({x:1,y:0});} a.step();b.step(); }
  assert.deepEqual(a.particles,b.particles);
  assert.notDeepEqual(a.particles,initial);
  for(const q of a.particles){ assert.ok(Math.abs(q.x)<=1.5&&Math.abs(q.y)<=1.5);assert.ok(Number.isFinite(q.vx)&&Number.isFinite(q.vy)); }
  assert.deepEqual(new EquationSimulation(p,1.5,60).particles,initial);
  assert.throws(()=>new EquationSimulation(p,0,60));
});
test('existing component expressions and finite field guard remain operational', () => {
  const field=compileField('-y','x').field(2,3,0);
  assert.deepEqual(field,{vx:-3,vy:2});
  const expression=compileExpr('sin(pi/2) + 2x');
  assert.ok(expression.ok);
  if(expression.ok) assert.equal(expression.fn(2,0,0),5);
  assert.deepEqual(compileField('1/0','sqrt(-1)').field(0,0,0),{vx:0,vy:0});
});

const material: InteractionSpecies = { mass: 1, charge: 0, contactRadius: 0.03, interactionRadius: 0.5, attraction: 0.2, repulsion: 1, restitution: 0.5 };
const particle = (x: number, y = 0, vx = 0, species = 0): InteractingParticle => ({x,y,vx,vy:0,species});

test('local force attracts at medium range, repels inside contact and vanishes at cutoff', () => {
  assert.ok(pairForce(0.25,material,material)>0);
  assert.ok(pairForce(0.01,material,material)<0);
  assert.equal(pairForce(0.5,material,material),0);
  assert.equal(pairForce(5,material,material),0);
  const charged={...material,charge:1,attraction:0};
  assert.ok(pairForce(0.25,charged,charged)<0);
  assert.ok(pairForce(0.25,charged,{...charged,charge:-1})>0);
  assert.equal(pairForce(0.25,charged,material),pairForce(0.25,material,charged));
});
test('linked-cell search matches brute-force neighbors including negative coordinates and cell edges', () => {
  const particles=Array.from({length:80},(_,i)=>particle(Math.sin(i*11)*3,Math.cos(i*7)*3));
  particles.push(particle(-0.001),particle(0.001),particle(0.499),particle(0.501));
  const grid=new SpatialPairs(), seen=new Set<string>(), actual:string[]=[], expected:string[]=[];
  grid.visit(particles,0.5,(i,j)=>{
    const key=`${i},${j}`;assert.ok(!seen.has(key));seen.add(key);
    const a=particles[i]!,b=particles[j]!;
    if(Math.hypot(a.x-b.x,a.y-b.y)<0.5)actual.push(key);
  });
  for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){
    const a=particles[i]!,b=particles[j]!;
    if(Math.hypot(a.x-b.x,a.y-b.y)<0.5)expected.push(`${i},${j}`);
  }
  assert.deepEqual(actual.sort(),expected.sort());
  grid.visit(Array.from({length:900},(_,i)=>particle(i*2)),0.5,()=>{throw new Error('Distant pair visited');});
  assert.equal(grid.candidateChecks,0);
});
test('pair force is equal and opposite and changing mass changes acceleration, not force', () => {
  const species=[material,{...material,mass:3}];
  const pairs=new ParticleInteractions(species,2);
  pairs.accumulate([particle(0),particle(0.25,0,0,1)],species);
  assert.equal(pairs.forceX[0],-pairs.forceX[1]!);
  assert.ok(pairs.forceX[0]!>0);
  assert.equal(pairs.forceX[0]! / material.mass, -3*pairs.forceX[1]! / species[1]!.mass);
});
test('collision conserves isolated-pair momentum, reduces kinetic energy, and leaves tangential velocity intact', () => {
  const species=[material,{...material,mass:3}];
  const particles=[particle(-0.02,0,1),particle(0.02,0,-0.5,1)];
  particles[0]!.vy=0.2;particles[1]!.vy=0.2;
  const momentum=()=>particles.reduce((sum,p)=>sum+p.vx*species[p.species]!.mass,0);
  const energy=()=>particles.reduce((sum,p)=>sum+0.5*species[p.species]!.mass*(p.vx*p.vx+p.vy*p.vy),0);
  const beforeP=momentum(),beforeE=energy();
  new ParticleInteractions(species,2).resolveContacts(particles,species);
  assert.ok(Math.abs(momentum()-beforeP)<1e-12);
  assert.ok(energy()<beforeE);
  assert.ok(particles[1]!.vx-particles[0]!.vx>0);
  assert.equal(particles[0]!.vy,0.2);assert.equal(particles[1]!.vy,0.2);
});
test('coincident particles separate deterministically without NaN or random-state dependence', () => {
  const run=()=>{const ps=[particle(0),particle(0)];new ParticleInteractions([material],2).resolveContacts(ps,[material]);return ps;};
  const a=run();assert.deepEqual(a,run());
  assert.ok(Math.hypot(a[0]!.x-a[1]!.x,a[0]!.y-a[1]!.y)>0);
  assert.ok(a.every(p=>[p.x,p.y,p.vx,p.vy].every(Number.isFinite)));
});
test('interaction option preserves field-only integration and interactions affect trajectories', () => {
  const p=compileEquation('1+1');
  const active=new EquationSimulation(p,1.5,2),legacy=new EquationSimulation(p,1.5,2,{interactions:false});
  for(const sim of [active,legacy]) {sim.particles[0]!.x=-0.01;sim.particles[0]!.y=0;sim.particles[1]!.x=0.01;sim.particles[1]!.y=0;sim.step();}
  assert.notDeepEqual(active.particles,legacy.particles);
  assert.equal(active.dynamicsVersion,'edc-dynamics-v2');
});
test('900-particle runs remain bounded after dense injection and collisions', () => {
  const simulation=new EquationSimulation(compileEquation('1+1+1=2'),1.5,900);
  simulation.inject({x:0,y:0});
  for(let step=0;step<240;step++)simulation.step();
  for(const p of simulation.particles){assert.ok([p.x,p.y,p.vx,p.vy].every(Number.isFinite));assert.ok(Math.abs(p.x)<=1.5&&Math.abs(p.y)<=1.5);assert.ok(Math.abs(p.vx)<=4&&Math.abs(p.vy)<=4);}
});
