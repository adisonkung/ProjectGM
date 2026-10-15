/**
 * Particle presets (Pixi renderer only — the DOM board ignores them). An FX names the presets it carries
 * (`FxDef.particles`); they spawn at the FX's pivot on the board when the FX starts and run on the board's game clock
 * (frozen by pause / hit-stop, × battle speed). Units: board cells and seconds; angles in degrees (0 = right,
 * −90 = up), mirrored for a left-facing FX. Logic: `battle/render/particles.ts`.
 */
export type ParticleShape = 'spark' | 'dot' | 'chunk' | 'puff' | 'petal';

export interface ParticleDef {
  /** burst size at spawn */
  count: number;
  /** continuous emission (particles / s) for `duration` s (default: the FX's own length) */
  rate?: number;
  duration?: number;
  /** life (s) [min, max] */
  life: [number, number];
  /** start speed (cells / s) [min, max] */
  speed: [number, number];
  /** launch direction range (deg) */
  angle: [number, number];
  /** cells / s² (+ = down) */
  gravity: number;
  /** velocity kept per second (0.2 = loses 80 % a second) */
  drag?: number;
  /** start size (cells) [min, max] · size at the end of life × sizeEnd */
  size: [number, number];
  sizeEnd?: number;
  colors: number[];
  /** alpha at the end of life (fades linearly from 1) */
  alphaEnd?: number;
  blend?: 'add' | 'normal';
  shape: ParticleShape;
  /** spawn box around the point (cells) [width, height] */
  area?: [number, number];
  /** rotation speed (deg / s) [min, max] (chunks / petals) */
  spin?: [number, number];
}

/** a preset reference on an FX: name + optional tint / amount */
export type ParticleRef = string | { name: string; colors?: number[]; count?: number; scale?: number };

export const PARTICLES: Record<string, ParticleDef> = {
  /** hit sparks: thin streaks flying out of the contact point */
  sparks: {
    count: 12, life: [0.18, 0.38], speed: [5, 11], angle: [-180, 180], gravity: 10, drag: 0.05,
    size: [0.1, 0.16], sizeEnd: 0.4, colors: [0xfff1b8, 0xffc35a, 0xff8a3a], blend: 'add', shape: 'spark',
  },
  /** embers bursting out of a heavy blow */
  embers: {
    count: 22, life: [0.5, 1.1], speed: [2.5, 7], angle: [-160, -20], gravity: 3, drag: 0.25,
    size: [0.06, 0.12], sizeEnd: 0.3, colors: [0xffe08a, 0xff9a3c, 0xff5a2a], blend: 'add', shape: 'dot', area: [0.8, 0.2],
  },
  /** rock chunks thrown up by a slam */
  debris: {
    count: 12, life: [0.5, 0.9], speed: [3, 7], angle: [-150, -30], gravity: 22, drag: 0.6,
    size: [0.08, 0.16], sizeEnd: 0.8, colors: [0x6b5a48, 0x8a7258, 0x4a3e33], alphaEnd: 0.6, blend: 'normal', shape: 'chunk',
    area: [0.6, 0.1], spin: [-540, 540],
  },
  /** ground dust ring of a slam / landing */
  dust: {
    count: 10, life: [0.45, 0.8], speed: [1.2, 3], angle: [-175, -5], gravity: -0.6, drag: 0.08,
    size: [0.35, 0.55], sizeEnd: 1.9, colors: [0xcbb89a, 0xb19c7e], alphaEnd: 0, blend: 'normal', shape: 'puff', area: [0.6, 0.05],
  },
  /** embers rising around a charging hero (continuous) */
  'ember-rise': {
    count: 0, rate: 26, life: [0.6, 1.2], speed: [0.6, 1.6], angle: [-110, -70], gravity: -1.2, drag: 0.4,
    size: [0.05, 0.1], sizeEnd: 0.2, colors: [0xffd27a, 0xff8a3a, 0xff4a2a], blend: 'add', shape: 'dot', area: [1.1, 0.3],
  },
  /** lotus petals drifting from a heal bloom */
  petals: {
    count: 14, life: [0.9, 1.5], speed: [0.8, 2.2], angle: [-170, -10], gravity: 1.2, drag: 0.35,
    size: [0.1, 0.16], sizeEnd: 0.7, colors: [0xffc2de, 0xff9ac6, 0xfff0f6], blend: 'normal', shape: 'petal', area: [0.8, 0.4],
    spin: [-240, 240],
  },
  /** shadow wisps (Mo Ye reappear) */
  mist: {
    count: 10, life: [0.5, 0.9], speed: [0.6, 1.8], angle: [-180, 180], gravity: -0.8, drag: 0.2,
    size: [0.3, 0.45], sizeEnd: 1.6, colors: [0x3a2650, 0x5a3a7a], alphaEnd: 0, blend: 'normal', shape: 'puff', area: [0.5, 0.4],
  },
};

/** the preset with an FX's overrides applied */
export function particleDef(ref: ParticleRef): ParticleDef | undefined {
  const name = typeof ref === 'string' ? ref : ref.name;
  const base = PARTICLES[name];
  if (!base || typeof ref === 'string') return base;
  const k = ref.scale ?? 1;
  return {
    ...base,
    colors: ref.colors ?? base.colors,
    count: ref.count ?? base.count,
    size: [base.size[0] * k, base.size[1] * k],
    speed: [base.speed[0] * k, base.speed[1] * k],
  };
}
