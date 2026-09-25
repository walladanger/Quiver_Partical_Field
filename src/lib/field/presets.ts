export type FieldPreset = {
  id: string;
  name: string;
  hint: string;
  vx: string;
  vy: string;
};

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: "swirl",
    name: "Swirl",
    hint: "Rigid rotation around the origin",
    vx: "-y",
    vy: "x",
  },
  {
    id: "spiral",
    name: "Spiral",
    hint: "Inward swirl",
    vx: "-y - 0.35*x",
    vy: "x - 0.35*y",
  },
  {
    id: "sink",
    name: "Sink",
    hint: "Everything flows inward",
    vx: "-x",
    vy: "-y",
  },
  {
    id: "source",
    name: "Source",
    hint: "Everything flows outward",
    vx: "x",
    vy: "y",
  },
  {
    id: "saddle",
    name: "Saddle",
    hint: "Hyperbolic point",
    vx: "x",
    vy: "-y",
  },
  {
    id: "shear",
    name: "Shear",
    hint: "Horizontal sliding",
    vx: "y",
    vy: "0",
  },
  {
    id: "vortex",
    name: "Vortex",
    hint: "Circulation that fades with r",
    vx: "-y / (r^2 + 0.4)",
    vy: "x / (r^2 + 0.4)",
  },
  {
    id: "gyre",
    name: "Gyre",
    hint: "Closed cells of flow",
    vx: "sin(x) * cos(y)",
    vy: "-cos(x) * sin(y)",
  },
  {
    id: "waves",
    name: "Waves",
    hint: "Uses time t — press play",
    vx: "sin(y + t)",
    vy: "cos(x + t)",
  },
  {
    id: "pendulum",
    name: "Pendulum",
    hint: "Phase portrait of a pendulum",
    vx: "y",
    vy: "-sin(x)",
  },
  {
    id: "cycle",
    name: "Limit cycle",
    hint: "Van der Pol oscillator",
    vx: "y",
    vy: "(1 - x^2) * y - x",
  },
  {
    id: "dipole",
    name: "Dipole",
    hint: "Complex square z²",
    vx: "x^2 - y^2",
    vy: "2*x*y",
  },
];

export const DEFAULT_PRESET_ID = "swirl";

export function presetById(id: string): FieldPreset | undefined {
  return FIELD_PRESETS.find((p) => p.id === id);
}
