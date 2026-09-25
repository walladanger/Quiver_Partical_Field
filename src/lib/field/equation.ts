/** EDC v1: structural, deterministic artistic dynamics. No PDE solver claims. */
import { ParticleInteractions } from './interactions.ts';
export type Ast = { kind: 'number'; value: number } | { kind: 'symbol'; name: string }
  | { kind: 'call'; name: string; args: Ast[] }
  | { kind: 'unary'; op: string; value: Ast }
  | { kind: 'binary'; op: string; left: Ast; right: Ast };
export type Features = {
  constants: number; variables: number; operators: number; depth: number;
  power: number; derivatives: number; spatial: number; temporal: number;
  oscillation: number; phase: number; diffusion: number; integrals: number;
  exponential: number; anisotropy: number; curl: number; divergence: number;
  residual: number | null;
};
const functions: Record<string, (...v: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log,
  ln: Math.log, sqrt: Math.sqrt, abs: Math.abs, pow: Math.pow,
  min: Math.min, max: Math.max, atan2: Math.atan2, hypot: Math.hypot,
};
const count = (s: string, pattern: RegExp) => (s.match(pattern) ?? []).length;
const bounded = (n: number, limit = 8) => Number.isFinite(n) ? Math.max(-limit, Math.min(limit, n)) : 0;

export function normalizeEquation(source: string): string {
  // Keep token boundaries: “x y” must not silently become the symbol “xy”.
  return source.normalize('NFC').replace(/[−–—]/g, '-').replace(/[×·]/g, '*')
    .replace(/π/g, 'pi').replace(/θ/g, 'theta').trim().replace(/\s+/g, ' ');
}

export function parseEquation(source: string): Ast {
  if (!source.trim() || source.length > 4096) throw new Error('Use 1–4096 characters.');
  const tokens = source.match(/(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?|[\p{L}_][\p{L}\p{N}_]*|[^\s]/gu) ?? [];
  let i = 0, depth = 0;
  function expr(min = 0): Ast {
    if (++depth > 64) throw new Error('Expression nesting limit reached.');
    const t = tokens[i++];
    let left: Ast;
    if (t === '+' || t === '-') left = { kind: 'unary', op: t, value: expr(30) };
    else if (t === '(') { left = expr(); if (tokens[i++] !== ')') throw new Error('Missing closing parenthesis.'); }
    else if (t && /^(?:\d|\.)/.test(t) && Number.isFinite(Number(t))) left = { kind: 'number', value: Number(t) };
    else if (t && /^[\p{L}_][\p{L}\p{N}_]*$/u.test(t)) {
      if (tokens[i] === '(' && Object.hasOwn(functions, t)) {
        i++; const args = [expr()];
        while (tokens[i] === ',') { i++; args.push(expr()); }
        if (tokens[i++] !== ')') throw new Error('Missing closing parenthesis.');
        const arity = ['pow', 'atan2'].includes(t) ? 2 : ['min', 'max', 'hypot'].includes(t) ? args.length : 1;
        if (args.length !== arity) throw new Error('Invalid function argument count.');
        left = { kind: 'call', name: t, args };
      } else left = { kind: 'symbol', name: t };
    } else throw new Error('Unsupported or incomplete notation.');
    while (i < tokens.length) {
      const next = tokens[i]!;
      const implicit = next === '(' || /^[\p{L}_\d.]/u.test(next);
      const op = implicit ? '*' : next;
      const precedence = op === '+' || op === '-' ? 10 : ['*', '/', '%'].includes(op) ? 20 : op === '^' ? 30 : -1;
      if (precedence < min) break;
      if (!implicit) i++;
      left = { kind: 'binary', op, left, right: expr(precedence + (op === '^' ? 0 : 1)) };
    }
    depth--; return left;
  }
  const left = expr();
  const ast: Ast = tokens[i] === '=' ? (i++, { kind: 'binary', op: '=', left, right: expr() }) : left;
  if (i !== tokens.length) throw new Error('Unsupported or incomplete notation.');
  return ast;
}

function constantValue(ast: Ast): number | null {
  if (ast.kind === 'number') return ast.value;
  if (ast.kind === 'symbol') return ast.name === 'pi' ? Math.PI : ast.name === 'e' ? Math.E : null;
  if (ast.kind === 'unary') { const v = constantValue(ast.value); return v === null ? null : ast.op === '-' ? -v : v; }
  if (ast.kind === 'call') {
    const args = ast.args.map(constantValue);
    if (args.some(v => v === null)) return null;
    const v = functions[ast.name]!(...(args as number[]));
    return Number.isFinite(v) ? v : null;
  }
  const a = constantValue(ast.left), b = constantValue(ast.right);
  if (a === null || b === null) return null;
  const v = ast.op === '+' ? a+b : ast.op === '-' || ast.op === '=' ? a-b : ast.op === '*' ? a*b : ast.op === '/' ? a/b : ast.op === '%' ? a%b : a**b;
  return Number.isFinite(v) ? v : null;
}

/** SHA-256, synchronous so compiling cannot race equation edits or a reset. */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  data.set(bytes); data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(data.length - 4, bytes.length * 8);
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p !== 0)) primes.push(n);
  const h = primes.slice(0, 8).map(p => (Math.sqrt(p) % 1 * 2**32) >>> 0);
  const k = primes.map(p => (Math.cbrt(p) % 1 * 2**32) >>> 0);
  const w = new Uint32Array(64);
  const r = (x: number, n: number) => (x >>> n) | (x << (32-n));
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(offset + j*4);
    for (let j = 16; j < 64; j++) {
      const a = w[j-15]!, b = w[j-2]!;
      w[j] = w[j-16]! + (r(a,7)^r(a,18)^(a>>>3)) + w[j-7]! + (r(b,17)^r(b,19)^(b>>>10));
    }
    let [a,b,c,d,e,f,g,hh] = h as [number,number,number,number,number,number,number,number];
    for (let j = 0; j < 64; j++) {
      const t1 = (hh + (r(e,6)^r(e,11)^r(e,25)) + ((e&f)^(~e&g)) + k[j]! + w[j]!) | 0;
      const t2 = ((r(a,2)^r(a,13)^r(a,22)) + ((a&b)^(a&c)^(b&c))) | 0;
      hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,hh].forEach((v,j) => { h[j] = (h[j]! + v) >>> 0; });
  }
  return h.map(v => v.toString(16).padStart(8,'0')).join('');
}

export function randomFromSeed(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = (t + Math.imul(t ^ t>>>7, 61|t)) ^ t; return ((t ^ t>>>14)>>>0) / 4294967296; };
}

export const EQUATION_PRESETS = [
  { name: 'Arithmetic', equation: '1+1+1=2' },
  { name: 'Navier–Stokes', equation: '∂u/∂t + (u·∇)u = -∇p/ρ + ν∇²u' },
  { name: 'Maxwell', equation: '∇×E = -∂B/∂t' },
  { name: 'Schrödinger', equation: 'iℏ∂ψ/∂t = -ℏ²∇²ψ/(2m) + Vψ' },
  { name: 'Boltzmann', equation: '∂f/∂t + v·∇_r f + (F/m)·∇_v f = C(f)' },
  { name: 'Klein–Gordon', equation: '∂²φ/∂t² - ∇²φ + m²φ = 0' },
  { name: 'Dirac', equation: '(iγ^μ∂_μ - m)ψ = 0' },
  { name: 'Einstein', equation: 'R_μν - (1/2)Rg_μν + Λg_μν = 8pi G T_μν' },
] as const;

export function compileEquation(source: string, variation = 0) {
  const normalized = normalizeEquation(source.slice(0, 4096));
  let ast: Ast | null = null, diagnostic = '';
  try { ast = parseEquation(normalized); } catch (error) { diagnostic = (error as Error).message; }
  if (source.length > 4096) diagnostic = 'Only the first 4096 characters are used.';
  const f: Features = { constants: 0, variables: 0, operators: 0, depth: 0, power: 0,
    derivatives: count(normalized,/∂|\\partial/g), spatial: count(normalized,/∇|\\nabla/g),
    temporal: count(normalized,/(?:∂|\\partial)\s*t|\bt\b/g), oscillation: count(normalized,/\b(?:sin|cos|tan)\b/g),
    phase: count(normalized,/\bi\b|ψ|psi/g), diffusion: count(normalized,/∇(?:²|\^2)|laplacian/g),
    integrals: count(normalized,/∫|\\int\b/g), exponential: count(normalized,/\bexp\b|\be\^/g),
    anisotropy: count(normalized,/_[\p{L}]+/gu), curl: count(source.slice(0,4096),/∇\s*×|curl|\\nabla\s*\\times/g),
    divergence: count(source.slice(0,4096),/∇\s*·|divergence|\\nabla\s*\\cdot/g), residual: null };
  function visit(node: Ast, depth = 1) {
    f.depth = Math.max(f.depth, depth);
    if (node.kind === 'number') f.constants++;
    else if (node.kind === 'symbol') f.variables++;
    else if (node.kind === 'unary') { f.operators++; visit(node.value,depth+1); }
    else if (node.kind === 'call') { f.operators++; node.args.forEach(n => visit(n,depth+1)); }
    else { f.operators++; if (node.op === '^' && node.right.kind === 'number') f.power = Math.max(f.power, Math.min(16, Math.abs(node.right.value))); visit(node.left,depth+1); visit(node.right,depth+1); }
  }
  if (ast) { visit(ast); if (ast.kind === 'binary' && ast.op === '=') f.residual = constantValue(ast); }
  else {
    f.constants = count(normalized,/\d+(?:\.\d+)?/g);
    f.variables = new Set(normalized.match(/[\p{L}_]+/gu) ?? []).size;
    f.operators = count(normalized,/[+*/=^\-]/g);
    f.power = count(normalized,/[²³]|\^/g);
  }
  const complexity = f.operators + 2*f.variables + f.depth + 4*f.derivatives + 3*f.spatial + f.power;
  const augmentation = Math.max(0, Math.min(1, (40-complexity)/40));
  const canonical = ast ? JSON.stringify(ast) : normalized;
  const safeVariation = Number.isSafeInteger(variation) && variation >= 0 ? variation : 0;
  const fingerprint = sha256(JSON.stringify(['edc-v1',canonical,safeVariation]));
  const seed = parseInt(fingerprint.slice(0,8),16);
  const rng = randomFromSeed(seed);
  const features = Object.values(f).map(v => Math.tanh((v ?? 0)/8));
  const controls = Array.from({length:64},(_,j) => Math.tanh(features.reduce((sum,v,i) => sum + v*Math.sin((j+1)*(i+1)*1.618)/4,0) + (0.12+augmentation)* (rng()*2-1)));
  const species = Array.from({length:4},(_,j) => ({ mass: 0.5 * 8**((controls[j]!+1)/2),
    drag: 0.5 + (controls[j+4]!+1), radius: 1.2+(controls[j+8]!+1)*0.8,
    charge: controls[j+12]!, noise: 0.03+(controls[j+16]!+1)*0.05,
    contactRadius: 0.018 + (controls[j+20]!+1)*0.009,
    interactionRadius: 0.35 + (controls[j+24]!+1)*0.15,
    attraction: 0.08 + (controls[j+28]!+1)*0.12,
    repulsion: 0.5 + (controls[j+32]!+1)*0.5,
    restitution: 0.2 + (controls[j+36]!+1)*0.3 }));
  const harmonics = Array.from({length:6},(_,j) => ({
    kx: 0.3+1.4*(controls[j*4]!+1)/2, ky: 0.3+1.4*(controls[j*4+1]!+1)/2,
    phase: (controls[j*4+2]!+1)*Math.PI, amplitude: 0.2+0.5*(controls[j*4+3]!+1)/2,
    omega: (0.1+Math.min(f.temporal+f.oscillation,8)*0.08)*(j%2 ? -1:1),
  }));
  function field(x: number,y: number,t: number) {
    let vx = 0, vy = 0;
    const rotation = 0.3 + Math.tanh((f.phase+f.curl+f.spatial)/4);
    for (const h of harmonics) {
      const c = h.amplitude*Math.cos(h.kx*x+h.ky*y+h.omega*t+h.phase);
      // -grad U plus the 2D curl of an out-of-plane vector potential.
      vx += -h.kx*c + rotation*h.ky*c;
      vy += -h.ky*c - rotation*h.kx*c;
    }
    const asymmetry = Math.tanh(f.residual ?? 0)*0.25;
    return {vx:bounded(vx-0.12*x+asymmetry),vy:bounded(vy-0.12*y-asymmetry)};
  }
  return {source,canonical,ast,diagnostic,features:f,complexity,augmentation,controls,species,harmonics,seed,fingerprint,variation:safeVariation,field,
    interpretation: ast ? 'Structured equation mapping' : 'Notation fingerprint (not a parsed physics equation)',
    mode: 'equation-driven' as const};
}
export type EquationProgram = ReturnType<typeof compileEquation>;

export type DynamicsParticle = {x:number;y:number;vx:number;vy:number;species:number};
export class EquationSimulation {
  readonly dynamicsVersion = 'edc-dynamics-v2';
  readonly particles: DynamicsParticle[] = [];
  time = 0;
  private rng: () => number;
  readonly program: EquationProgram;
  readonly range: number;
  private interactions: ParticleInteractions | null;
  constructor(program: EquationProgram, range: number, count: number, options: { interactions?: boolean } = {}) {
    this.program = program;
    this.range = range;
    if (!Number.isFinite(range) || range <= 0 || !Number.isInteger(count) || count < 0 || count > 5000) throw new Error('Invalid simulation bounds.');
    this.rng = randomFromSeed(program.seed);
    this.interactions = options.interactions === false ? null : new ParticleInteractions(program.species, count);
    for (let i=0;i<count;i++) this.particles.push(this.spawn(i%program.species.length));
  }
  private spawn(species: number, near?: {x:number;y:number}): DynamicsParticle {
    const radius = this.range*(near ? 0.04:0.92);
    return {x:(near?.x??0)+(this.rng()*2-1)*radius,y:(near?.y??0)+(this.rng()*2-1)*radius,vx:0,vy:0,species};
  }
  inject(near: {x:number;y:number}) {
    for (let i=0;i<Math.min(18,this.particles.length);i++) this.particles[i] = this.spawn(i%4,near);
  }
  /** Fixed numerical step. Caller controls elapsed-time accumulation. */
  step() {
    const dt=1/120;
    this.interactions?.accumulate(this.particles, this.program.species);
    for (let i=0; i<this.particles.length; i++) {
      const p=this.particles[i]!;
      const s=this.program.species[p.species]!;
      const force=this.program.field(p.x,p.y,this.time);
      const pairX=bounded(this.interactions?.forceX[i] ?? 0);
      const pairY=bounded(this.interactions?.forceY[i] ?? 0);
      p.vx=bounded((p.vx+(force.vx+s.charge*0.1+pairX)*dt/s.mass)*Math.exp(-s.drag*dt) + (this.rng()*2-1)*s.noise*Math.sqrt(dt),4);
      p.vy=bounded((p.vy+(force.vy-s.charge*0.1+pairY)*dt/s.mass)*Math.exp(-s.drag*dt) + (this.rng()*2-1)*s.noise*Math.sqrt(dt),4);
      p.x+=p.vx*dt; p.y+=p.vy*dt;
    }
    this.interactions?.resolveContacts(this.particles, this.program.species);
    for (const p of this.particles) {
      p.vx=bounded(p.vx,4); p.vy=bounded(p.vy,4);
      for (const axis of ['x','y'] as const) if (Math.abs(p[axis])>this.range) { p[axis]=bounded(p[axis],this.range); p[axis==='x'?'vx':'vy'] *= -0.8; }
    }
    this.time+=dt;
  }
}
