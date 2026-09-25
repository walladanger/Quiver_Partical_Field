import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PRESET_ID, presetById } from "./presets";

export type ColorMode = "magnitude" | "heading";

export type HoverSample = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type FieldStore = {
  vxSrc: string;
  vySrc: string;
  presetId: string;
  playing: boolean;
  density: number;
  arrowScale: number;
  normalize: boolean;
  particleCount: number;
  speed: number;
  trails: boolean;
  showArrows: boolean;
  showHeat: boolean;
  colorMode: ColorMode;
  range: number;
  seed: number;
  reducedMotion: boolean;
  setVx: (vxSrc: string) => void;
  setVy: (vySrc: string) => void;
  applyPreset: (id: string) => void;
  togglePlaying: () => void;
  setPlaying: (playing: boolean) => void;
  setDensity: (density: number) => void;
  setArrowScale: (arrowScale: number) => void;
  setNormalize: (normalize: boolean) => void;
  setParticleCount: (particleCount: number) => void;
  setSpeed: (speed: number) => void;
  setTrails: (trails: boolean) => void;
  setShowArrows: (showArrows: boolean) => void;
  setShowHeat: (showHeat: boolean) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setRange: (range: number) => void;
  reseed: () => void;
  setReducedMotion: (reducedMotion: boolean) => void;
};

const swirl = presetById(DEFAULT_PRESET_ID)!;

export const useFieldStore = create<FieldStore>()(
  persist(
    (set) => ({
      vxSrc: swirl.vx,
      vySrc: swirl.vy,
      presetId: swirl.id,
      playing: true,
      density: 18,
      arrowScale: 0.72,
      normalize: false,
      particleCount: 420,
      speed: 1,
      trails: true,
      showArrows: true,
      showHeat: true,
      colorMode: "magnitude",
      range: 4,
      seed: 1,
      reducedMotion: false,
      setVx: (vxSrc) => set({ vxSrc, presetId: "custom" }),
      setVy: (vySrc) => set({ vySrc, presetId: "custom" }),
      applyPreset: (id) => {
        const p = presetById(id);
        if (!p) return;
        set({
          presetId: p.id,
          vxSrc: p.vx,
          vySrc: p.vy,
          seed: Date.now(),
        });
      },
      togglePlaying: () => set((s) => ({ playing: !s.playing })),
      setPlaying: (playing) => set({ playing }),
      setDensity: (density) => set({ density }),
      setArrowScale: (arrowScale) => set({ arrowScale }),
      setNormalize: (normalize) => set({ normalize }),
      setParticleCount: (particleCount) => set({ particleCount }),
      setSpeed: (speed) => set({ speed }),
      setTrails: (trails) => set({ trails }),
      setShowArrows: (showArrows) => set({ showArrows }),
      setShowHeat: (showHeat) => set({ showHeat }),
      setColorMode: (colorMode) => set({ colorMode }),
      setRange: (range) => set({ range }),
      reseed: () => set({ seed: Date.now() }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: "quiver-field-v1",
      skipHydration: true,
      partialize: (s) => ({
        vxSrc: s.vxSrc,
        vySrc: s.vySrc,
        presetId: s.presetId,
        density: s.density,
        arrowScale: s.arrowScale,
        normalize: s.normalize,
        particleCount: s.particleCount,
        speed: s.speed,
        trails: s.trails,
        showArrows: s.showArrows,
        showHeat: s.showHeat,
        colorMode: s.colorMode,
        range: s.range,
      }),
    },
  ),
);
