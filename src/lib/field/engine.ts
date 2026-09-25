/** Typed public interface for embedding the equation-driven graphics engine. */
import { compileEquation, EquationSimulation, type EquationProgram } from './equation.ts';
import { EquationSimulation3D } from './dynamics-3d.ts';

export type EngineOptions = {
  equation: string;
  variation?: number;
  dimensions?: 2 | 3;
  range?: number;
  particleCount?: number;
};

export class QuiverEngine {
  readonly program: EquationProgram;
  readonly dimensions: 2 | 3;
  readonly simulation: EquationSimulation | EquationSimulation3D;
  constructor(options: EngineOptions) {
    this.dimensions = options.dimensions ?? 3;
    this.program = compileEquation(options.equation, options.variation ?? 0);
    const range = options.range ?? 4, count = options.particleCount ?? 420;
    this.simulation = this.dimensions === 3
      ? new EquationSimulation3D(this.program, range, count)
      : new EquationSimulation(this.program, range, count);
  }
  get particles() { return this.simulation.particles; }
  get time() { return this.simulation.time; }
  step(steps = 1) {
    if (!Number.isInteger(steps) || steps < 0 || steps > 10000) throw new Error('Invalid step count.');
    for (let i = 0; i < steps; i++) this.simulation.step();
  }
}

export function createGraphicsEngine(options: EngineOptions): QuiverEngine {
  return new QuiverEngine(options);
}
