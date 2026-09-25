import { create } from 'zustand';
import { compileEquation, type EquationProgram } from './equation';

type EquationState = {
  enabled: boolean;
  program: EquationProgram;
  revision: number;
  apply: (source: string, variation: number) => void;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
};

// Separate from existing persisted settings: adding EDC never rewrites a saved field.
export const useEquationStore = create<EquationState>((set) => ({
  enabled: false,
  program: compileEquation('1+1+1=2'),
  revision: 0,
  apply: (source, variation) => set(s => ({program: compileEquation(source,variation), enabled:true, revision:s.revision+1})),
  setEnabled: enabled => set(s => ({enabled, revision:s.revision+1})),
  reset: () => set(s => ({revision:s.revision+1})),
}));
